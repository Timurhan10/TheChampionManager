import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ALL_OUTFIELD_ATTRS, GOALKEEPING_ATTRS } from "@/lib/attributes";

const REVEAL_ALL_COST = 500;

// 500 CR ile bir oyuncunun TÜM özelliklerini açar (yetersiz CR → uyarı, işlem yok).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { playerId: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  if (!body.playerId) return NextResponse.json({ error: "Oyuncu belirtilmedi." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: player } = await svc.from("players").select("id, position, team_id").eq("id", body.playerId).maybeSingle();
  if (!player) return NextResponse.json({ error: "Oyuncu bulunamadı." }, { status: 404 });
  if (player.team_id === team.id) return NextResponse.json({ error: "Kendi oyuncunun zaten tüm özellikleri görünür." }, { status: 400 });

  // Zaten tam açılmış mı? (tekrar ücret alma)
  const allKeys = player.position === "GK" ? [...ALL_OUTFIELD_ATTRS, ...GOALKEEPING_ATTRS] : [...ALL_OUTFIELD_ATTRS];
  const { data: existing } = await svc
    .from("scouting_reports")
    .select("revealed_attributes")
    .eq("scout_team_id", team.id)
    .eq("target_player_id", player.id)
    .eq("status", "completed");
  const known = new Set<string>();
  for (const r of existing ?? []) for (const k of ((r as any).revealed_attributes?.keys ?? [])) known.add(k);
  if (allKeys.every((k) => known.has(k))) {
    return NextResponse.json({ ok: true, alreadyRevealed: true });
  }

  // CR kontrolü + düşüm
  const { data: gameUser } = await svc.from("users").select("credits").eq("id", user.id).single();
  if (!gameUser || gameUser.credits < REVEAL_ALL_COST) {
    return NextResponse.json({ error: `Yetersiz CR. Bu işlem ${REVEAL_ALL_COST} CR gerektirir.` }, { status: 400 });
  }

  const { error: insErr } = await svc.from("scouting_reports").insert({
    scout_team_id: team.id,
    target_player_id: player.id,
    level: "full",
    cost_cr: REVEAL_ALL_COST,
    revealed_attributes: { keys: allKeys },
    status: "completed",
    completes_at: new Date().toISOString(),
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  await svc.rpc("add_credits", { uid: user.id, delta: -REVEAL_ALL_COST });

  return NextResponse.json({ ok: true });
}
