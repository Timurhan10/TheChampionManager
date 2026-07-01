import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateSchedule, type MatchDay } from "@/lib/schedule-generator";
import { generatePlayer } from "@/lib/player-generator";
import { SEASON_CMP, SEASON_CR } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/types/game";

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];

async function youthIntake(svc: SupabaseClient, teamId: string) {
  const { data: academy } = await svc.from("youth_academy").select("is_active").eq("team_id", teamId).maybeSingle();
  if (!academy?.is_active) return 0;
  const count = 1 + Math.floor(Math.random() * 3);
  const rows = Array.from({ length: count }).map(() => {
    const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const age = 16 + Math.floor(Math.random() * 4);
    const gen = generatePlayer({ position, age, isYouth: true, attrMin: 6, attrMax: 11 });
    return { team_id: teamId, name: gen.name, age, position, is_youth_academy: true, potential: 14 + Math.floor(Math.random() * 7), value_cr: gen.value_cr, ...gen.attributes };
  });
  await svc.from("players").insert(rows);
  await svc.from("youth_academy").update({ last_intake_at: new Date().toISOString() }).eq("team_id", teamId);
  return count;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { leagueId: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: league } = await svc.from("leagues").select("*").eq("id", body.leagueId).maybeSingle();
  if (!league) return NextResponse.json({ error: "Lig bulunamadı." }, { status: 404 });
  if (league.creator_id !== user.id) return NextResponse.json({ error: "Sadece lig kurucusu sezonu kapatabilir." }, { status: 403 });

  // Tüm maçlar bitti mi?
  const { count: pending } = await svc.from("matches").select("id", { count: "exact", head: true })
    .eq("league_id", league.id).neq("status", "finished");
  if ((pending ?? 0) > 0) return NextResponse.json({ error: "Önce tüm maçlar oynanmalı." }, { status: 400 });

  // Puan tablosu sıralaması
  const { data: lt } = await svc.from("league_teams")
    .select("team_id, points, wins, draws, losses, goals_for, goals_against, teams(user_id, is_ai)")
    .eq("league_id", league.id);

  const standings = (lt ?? []).map((r: any) => ({
    team_id: r.team_id, userId: r.teams?.user_id ?? null, isAi: r.teams?.is_ai ?? true,
    points: r.points, losses: r.losses, gd: r.goals_for - r.goals_against, gf: r.goals_for,
  })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

  // Ödüller + sezon başı bonus + youth intake (insan takımlar)
  const summary: { team: string; cmp: number }[] = [];
  for (let i = 0; i < standings.length; i++) {
    const s = standings[i];
    if (s.isAi || !s.userId) continue;

    let cmp = 0;
    if (i === 0) cmp += SEASON_CMP.champion;
    else if (i === 1) cmp += SEASON_CMP.second;
    else if (i === 2) cmp += SEASON_CMP.third;
    if (s.losses === 0) cmp += SEASON_CMP.unbeaten;

    // CR ödülü dereceye göre (herkese koşulsuz 100k yerine)
    let cr: number = SEASON_CR.mid;
    if (i === 0) cr = SEASON_CR.first;
    else if (i === 1) cr = SEASON_CR.second;
    else if (i === 2) cr = SEASON_CR.third;
    else if (i >= standings.length - 2) cr = SEASON_CR.bottom;

    await svc.rpc("add_credits", { uid: s.userId, delta: cr });
    if (cmp) {
      const { data: u } = await svc.from("users").select("cmp_points").eq("id", s.userId).single();
      if (u) await svc.from("users").update({ cmp_points: u.cmp_points + cmp }).eq("id", s.userId);
    }
    await youthIntake(svc, s.team_id);
    await notify(svc, s.userId, "season_end",
      `Sezon ${league.season_number} bitti — ${i + 1}. sıra`,
      `+${cr.toLocaleString("tr-TR")} CR sezon ödülü${cmp ? `, +${cmp} CMP` : ""}.`);
  }

  // Puan tablosunu sıfırla
  await svc.from("league_teams").update({ points: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 }).eq("league_id", league.id);

  // Eski maçları sil, yeni fikstür üret
  await svc.from("matches").delete().eq("league_id", league.id);
  const teamIds = standings.map((s) => s.team_id);
  const matches = generateSchedule(teamIds, league.match_day_1 as MatchDay, league.match_day_2 as MatchDay, String(league.match_time).slice(0, 5))
    .map((m) => ({ ...m, league_id: league.id, status: "scheduled" as const }));
  await svc.from("matches").insert(matches);

  // Sezon numarası +1
  await svc.from("leagues").update({ season_number: league.season_number + 1 }).eq("id", league.id);

  return NextResponse.json({ ok: true, newSeason: league.season_number + 1, champion: standings[0]?.team_id });
}
