import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SCOUT_PACKAGES, pickRevealKeys, type ScoutLevelPkg } from "@/lib/scouting";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { targetPlayerId: string; level: ScoutLevelPkg };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const pkg = SCOUT_PACKAGES[body.level];
  if (!pkg) return NextResponse.json({ error: "Geçersiz scout paketi." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id, scout_level").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: target } = await svc.from("players").select("id, position, team_id").eq("id", body.targetPlayerId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Oyuncu bulunamadı." }, { status: 404 });
  if (target.team_id === team.id) return NextResponse.json({ error: "Kendi oyuncunu scout etmene gerek yok." }, { status: 400 });

  // CR kontrolü + düşüm
  const { data: gameUser } = await svc.from("users").select("credits").eq("id", user.id).single();
  if (!gameUser || gameUser.credits < pkg.cost) {
    return NextResponse.json({ error: "Yetersiz CR." }, { status: 400 });
  }

  const keys = pickRevealKeys(body.level, team.scout_level ?? 1, target.position);
  const completesAt = new Date(Date.now() + pkg.hours * 3600 * 1000).toISOString();
  const isInstant = pkg.hours === 0;

  const { error: insErr } = await svc.from("scouting_reports").insert({
    scout_team_id: team.id,
    target_player_id: target.id,
    level: body.level,
    cost_cr: pkg.cost,
    revealed_attributes: { keys },
    status: isInstant ? "completed" : "pending",
    completes_at: completesAt,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  await svc.from("users").update({ credits: gameUser.credits - pkg.cost }).eq("id", user.id);

  return NextResponse.json({ ok: true, instant: isInstant });
}
