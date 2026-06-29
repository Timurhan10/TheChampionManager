import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Satıcı gelen teklifi kabul/red eder. Kabulde oyuncu + CR el değiştirir.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { transferId: string; action: "accept" | "reject" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: seller } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!seller) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: transfer } = await svc.from("transfers").select("*").eq("id", body.transferId).maybeSingle();
  if (!transfer) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
  if (transfer.from_team_id !== seller.id) return NextResponse.json({ error: "Bu teklif sana ait değil." }, { status: 403 });
  if (transfer.status !== "pending") return NextResponse.json({ error: "Teklif zaten yanıtlanmış." }, { status: 400 });

  if (body.action === "reject") {
    await svc.from("transfers").update({ status: "rejected", resolved_at: new Date().toISOString() }).eq("id", transfer.id);
    return NextResponse.json({ ok: true });
  }

  // Kabul: alıcı ve satıcı kullanıcıları, CR transferi, oyuncu devri
  const { data: buyerTeam } = await svc.from("teams").select("id, user_id").eq("id", transfer.to_team_id).single();
  if (!buyerTeam?.user_id) return NextResponse.json({ error: "Alıcı takım geçersiz." }, { status: 400 });

  const { data: buyerUser } = await svc.from("users").select("credits").eq("id", buyerTeam.user_id).single();
  if (!buyerUser || buyerUser.credits < transfer.offer_amount) {
    // Alıcının parası yetmiyorsa teklifi iptal et
    await svc.from("transfers").update({ status: "cancelled", resolved_at: new Date().toISOString() }).eq("id", transfer.id);
    return NextResponse.json({ error: "Alıcının yeterli CR'si yok, teklif iptal edildi." }, { status: 400 });
  }

  const { data: sellerUser } = await svc.from("users").select("credits").eq("id", user.id).single();

  // Oyuncu devri + CR
  await svc.from("players").update({ team_id: transfer.to_team_id, for_sale: false, asking_price: null }).eq("id", transfer.player_id);
  await svc.from("users").update({ credits: buyerUser.credits - transfer.offer_amount }).eq("id", buyerTeam.user_id);
  if (sellerUser) {
    await svc.from("users").update({ credits: sellerUser.credits + transfer.offer_amount }).eq("id", user.id);
  }
  await svc.from("transfers").update({ status: "accepted", resolved_at: new Date().toISOString() }).eq("id", transfer.id);

  // Aynı oyuncuya gelen diğer bekleyen teklifleri iptal et
  await svc.from("transfers").update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("player_id", transfer.player_id).eq("status", "pending");

  return NextResponse.json({ ok: true });
}
