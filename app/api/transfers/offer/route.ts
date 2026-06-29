import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";

// Serbest ajan ise direkt satın alım; başka takıma aitse teklif oluşturur.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { playerId: string; amount?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: buyer } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!buyer) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: player } = await svc.from("players").select("id, team_id, value_cr, asking_price, for_sale, name").eq("id", body.playerId).maybeSingle();
  if (!player) return NextResponse.json({ error: "Oyuncu bulunamadı." }, { status: 404 });
  if (player.team_id === buyer.id) return NextResponse.json({ error: "Bu oyuncu zaten sende." }, { status: 400 });

  const { data: gameUser } = await svc.from("users").select("credits").eq("id", user.id).single();
  if (!gameUser) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 400 });

  // Serbest ajan → direkt satın alım
  if (player.team_id == null) {
    const price = player.asking_price ?? player.value_cr;
    if (gameUser.credits < price) return NextResponse.json({ error: "Yetersiz CR." }, { status: 400 });

    await svc.from("players").update({ team_id: buyer.id, for_sale: false, asking_price: null }).eq("id", player.id);
    await svc.from("users").update({ credits: gameUser.credits - price }).eq("id", user.id);
    await svc.from("transfers").insert({
      player_id: player.id, from_team_id: null, to_team_id: buyer.id,
      offer_amount: price, status: "accepted", resolved_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, purchased: true });
  }

  // Başka takıma ait → teklif
  const amount = Math.floor(body.amount ?? player.asking_price ?? player.value_cr);
  if (!amount || amount < 1) return NextResponse.json({ error: "Geçerli bir teklif gir." }, { status: 400 });
  if (gameUser.credits < amount) return NextResponse.json({ error: "Bu teklif için yeterli CR yok." }, { status: 400 });

  const { error: insErr } = await svc.from("transfers").insert({
    player_id: player.id, from_team_id: player.team_id, to_team_id: buyer.id,
    offer_amount: amount, status: "pending",
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  // Satıcıya bildirim
  const { data: sellerTeam } = await svc.from("teams").select("user_id").eq("id", player.team_id).maybeSingle();
  if (sellerTeam?.user_id) {
    await notify(svc, sellerTeam.user_id, "transfer_offer", `${player.name} için teklif geldi`,
      `${amount.toLocaleString("tr-TR")} CR teklif edildi.`);
  }

  return NextResponse.json({ ok: true, purchased: false });
}
