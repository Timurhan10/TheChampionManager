import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SCOUT_PACKAGES, pickRevealKeys, type ScoutLevelPkg } from "@/lib/scouting";
import { generatePlayer, type QualityTier } from "@/lib/player-generator";
import { countryByKey } from "@/lib/countries";
import type { Position } from "@/types/game";

function pickPosition(): Position {
  const r = Math.random();
  if (r < 0.1) return "GK";
  if (r < 0.4) return "DF";
  if (r < 0.75) return "MF";
  return "FW";
}
function tierForLevel(level: ScoutLevelPkg): QualityTier {
  if (level === "full") return Math.random() < 0.35 ? "elite" : "good";
  if (level === "detailed") return Math.random() < 0.5 ? "good" : "decent";
  return Math.random() < 0.4 ? "decent" : "common";
}

// Ülkeye direktör gönder: süreye göre 1-3 ülke-profilli oyuncu bulur (serbest ajan
// olarak eklenir), bilgi seviyesi süreye göre açılır. body: { country, level }
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { country: string; level: ScoutLevelPkg };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const country = countryByKey(body.country);
  const pkg = SCOUT_PACKAGES[body.level];
  if (!country || !pkg) return NextResponse.json({ error: "Geçersiz ülke veya süre." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id, scout_level").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: gameUser } = await svc.from("users").select("credits").eq("id", user.id).single();
  if (!gameUser || gameUser.credits < pkg.cost) return NextResponse.json({ error: "Yetersiz CR." }, { status: 400 });

  const isInstant = pkg.hours === 0;
  const completesAt = new Date(Date.now() + pkg.hours * 3600 * 1000).toISOString();
  const count = 1 + Math.floor(Math.random() * 3); // 1-3

  let created = 0;
  for (let i = 0; i < count; i++) {
    const position = pickPosition();
    const gen = generatePlayer({ position, tier: tierForLevel(body.level), country: country.key, age: 17 + Math.floor(Math.random() * 8) });
    const { data: ins, error: insErr } = await svc.from("players").insert({
      team_id: null, name: gen.name, age: gen.age, position,
      is_youth_academy: false, potential: gen.potential, value_cr: gen.value_cr,
      country: gen.country, ...gen.attributes,
    }).select("id, position").single();
    if (insErr || !ins) continue;

    const keys = pickRevealKeys(body.level, team.scout_level ?? 1, ins.position as Position);
    await svc.from("scouting_reports").insert({
      scout_team_id: team.id, target_player_id: ins.id, level: body.level, cost_cr: i === 0 ? pkg.cost : 0,
      revealed_attributes: { keys }, status: isInstant ? "completed" : "pending", completes_at: completesAt,
    });
    created++;
  }

  if (created === 0) return NextResponse.json({ error: "Oyuncu bulunamadı, tekrar dene." }, { status: 500 });

  // CR düş (atomik)
  await svc.rpc("add_credits", { uid: user.id, delta: -pkg.cost });

  return NextResponse.json({ ok: true, count: created, instant: isInstant, country: country.name });
}
