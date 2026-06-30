import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { computeSellPrice } from "@/lib/pricing";

// Oyuncuyu satışa çıkar / satıştan kaldır. Fiyat SİSTEM tarafından (gizli) belirlenir:
// maç oynamadıysa piyasa değeri; performansa göre ±.
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

  // Alt yapı oyuncuları satılamaz (bedava üretildikleri için exploit önlenir).
  if (body.forSale && player.is_youth_academy) {
    return NextResponse.json({ error: "Alt yapı oyuncuları satışa çıkarılamaz." }, { status: 400 });
  }

  if (body.forSale) {
    const price = computeSellPrice(player);
    // listed_at ile (3 gün garantisi); kolon yoksa onsuz devam
    const withTime = await svc.from("players").update({ for_sale: true, asking_price: price, listed_at: new Date().toISOString() }).eq("id", player.id);
    if (withTime.error) {
      await svc.from("players").update({ for_sale: true, asking_price: price }).eq("id", player.id);
    }
    return NextResponse.json({ ok: true, price });
  } else {
    const withTime = await svc.from("players").update({ for_sale: false, asking_price: null, listed_at: null }).eq("id", player.id);
    if (withTime.error) {
      await svc.from("players").update({ for_sale: false, asking_price: null }).eq("id", player.id);
    }
    return NextResponse.json({ ok: true });
  }
}
