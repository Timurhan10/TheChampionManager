import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { computeSellPrice } from "@/lib/pricing";
import { notify } from "@/lib/notifications";
import { SALE_PAID_MARK } from "@/lib/sales";

// Oyuncuyu ANINDA satar: fiyat sistemce (gizli, performansa göre) belirlenir,
// para hemen kasaya eklenir — sonradan gelmez. forSale=false ise satıştan kaldırır.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { playerId: string; forSale: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  // Fiyat hesabı için performans alanlarını da çek (kolon yoksa value_cr ile devam)
  let player: any = null;
  const sel = await svc.from("players").select("id, team_id, value_cr, matches_played, rating_sum, is_youth_academy").eq("id", body.playerId).maybeSingle();
  if (sel.error) {
    const fb = await svc.from("players").select("id, team_id, value_cr, is_youth_academy").eq("id", body.playerId).maybeSingle();
    player = fb.data;
  } else {
    player = sel.data;
  }
  if (!player || player.team_id !== team.id) return NextResponse.json({ error: "Bu oyuncu sana ait değil." }, { status: 403 });

  // Satıştan kaldırma (eski listelenmiş oyuncular için)
  if (!body.forSale) {
    const withTime = await svc.from("players").update({ for_sale: false, asking_price: null, listed_at: null }).eq("id", player.id);
    if (withTime.error) {
      await svc.from("players").update({ for_sale: false, asking_price: null }).eq("id", player.id);
    }
    return NextResponse.json({ ok: true });
  }

  // Alt yapı oyuncuları satılamaz (bedava üretildikleri için exploit önlenir).
  if (player.is_youth_academy) {
    return NextResponse.json({ error: "Alt yapı oyuncuları satılamaz." }, { status: 400 });
  }

  const price = computeSellPrice(player);

  // Bir AI alıcı seç (yoksa serbest ajana dönüşür — para yine ödenir).
  const { data: aiTeams } = await svc.from("teams").select("id").eq("is_ai", true);
  const aiIds = (aiTeams ?? []).map((t: any) => t.id);
  const buyer = aiIds.length ? aiIds[Math.floor(Math.random() * aiIds.length)] : null;

  // Atomik: yalnızca hâlâ bu takımdaysa sat (çift satış engeli). listed_at kolonu yoksa onsuz.
  let upd = await svc.from("players")
    .update({ team_id: buyer, for_sale: false, asking_price: null, listed_at: null })
    .eq("id", player.id).eq("team_id", team.id).select("id");
  if (upd.error) {
    upd = await svc.from("players")
      .update({ team_id: buyer, for_sale: false, asking_price: null })
      .eq("id", player.id).eq("team_id", team.id).select("id");
  }
  if (!upd.data || upd.data.length === 0) {
    return NextResponse.json({ error: "Oyuncu zaten elden çıkmış." }, { status: 400 });
  }

  // Parayı HEMEN öde (atomik artış — paralel satışlarda para kaybolmaz).
  const { error: payErr } = await svc.rpc("add_credits", { uid: user.id, delta: price });
  if (payErr) {
    await svc.from("players").update({ team_id: team.id, for_sale: false, asking_price: null }).eq("id", player.id);
    return NextResponse.json({ error: "Ödeme yapılamadı, tekrar dene." }, { status: 500 });
  }

  // Transfer kaydı (ödendi olarak işaretli → mutabakat tekrar kredilemez).
  await svc.from("transfers").insert({
    player_id: player.id, from_team_id: team.id, to_team_id: buyer,
    offer_amount: price, status: "accepted", resolved_at: new Date().toISOString(),
    message: SALE_PAID_MARK,
  });

  const { data: p } = await svc.from("players").select("name").eq("id", player.id).maybeSingle();
  await notify(svc, user.id, "transfer_result", `${p?.name ?? "Oyuncu"} satıldı`, `+${price.toLocaleString("tr-TR")} CR kasana eklendi.`);

  return NextResponse.json({ ok: true, sold: true, price });
}
