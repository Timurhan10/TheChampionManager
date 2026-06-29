import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Oyuncuyu satışa çıkar / satıştan kaldır.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { playerId: string; forSale: boolean; askingPrice?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: player } = await svc.from("players").select("id, team_id").eq("id", body.playerId).maybeSingle();
  if (!player || player.team_id !== team.id) return NextResponse.json({ error: "Bu oyuncu sana ait değil." }, { status: 403 });

  if (body.forSale) {
    const price = Math.max(1, Math.floor(body.askingPrice ?? 0));
    if (!price) return NextResponse.json({ error: "Geçerli bir fiyat gir." }, { status: 400 });
    await svc.from("players").update({ for_sale: true, asking_price: price }).eq("id", player.id);
  } else {
    await svc.from("players").update({ for_sale: false, asking_price: null }).eq("id", player.id);
  }

  return NextResponse.json({ ok: true });
}
