// Bir maçı simüle edip sonucu kalıcılaştırır: skor, olaylar, puan tablosu, CR ödülleri.
import type { SupabaseClient } from "@supabase/supabase-js";
import { simulateMatch, type EngineTeam } from "./simulator";
import { MATCH_REWARDS } from "@/lib/constants";
import type { Player, Tactics } from "@/types/game";

async function loadTeam(svc: SupabaseClient, teamId: string): Promise<EngineTeam> {
  const { data: team } = await svc.from("teams").select("id, name, is_ai, user_id").eq("id", teamId).single();
  const { data: players } = await svc.from("players").select("*").eq("team_id", teamId);
  const { data: tactics } = await svc.from("tactics").select("*").eq("team_id", teamId).maybeSingle();
  return {
    teamId,
    name: team?.name ?? "—",
    isAi: team?.is_ai ?? true,
    players: (players ?? []) as Player[],
    tactics: (tactics as Tactics) ?? null,
  };
}

async function applyStanding(
  svc: SupabaseClient,
  leagueId: string,
  teamId: string,
  gf: number,
  ga: number
) {
  const { data: row } = await svc
    .from("league_teams")
    .select("id, points, wins, draws, losses, goals_for, goals_against")
    .eq("league_id", leagueId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!row) return;

  const win = gf > ga, draw = gf === ga;
  await svc.from("league_teams").update({
    points: row.points + (win ? 3 : draw ? 1 : 0),
    wins: row.wins + (win ? 1 : 0),
    draws: row.draws + (draw ? 1 : 0),
    losses: row.losses + (!win && !draw ? 1 : 0),
    goals_for: row.goals_for + gf,
    goals_against: row.goals_against + ga,
  }).eq("id", row.id);
}

async function rewardTeam(svc: SupabaseClient, team: EngineTeam, gf: number, ga: number) {
  if (team.isAi) return;
  const { data: t } = await svc.from("teams").select("user_id").eq("id", team.teamId).single();
  if (!t?.user_id) return;
  const reward = gf > ga ? MATCH_REWARDS.win : gf === ga ? MATCH_REWARDS.draw : MATCH_REWARDS.loss;
  const { data: u } = await svc.from("users").select("credits").eq("id", t.user_id).single();
  if (u) {
    await svc.from("users").update({ credits: u.credits + reward }).eq("id", t.user_id);
  }
}

export async function runMatch(svc: SupabaseClient, matchId: string): Promise<{ error?: string; skipped?: boolean }> {
  const { data: match } = await svc
    .from("matches")
    .select("id, league_id, home_team_id, away_team_id, status")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "Maç bulunamadı." };
  if (match.status === "finished") return { skipped: true };

  const home = await loadTeam(svc, match.home_team_id);
  const away = await loadTeam(svc, match.away_team_id);

  const result = simulateMatch(home, away);

  const { error: updErr } = await svc.from("matches").update({
    home_score: result.homeScore,
    away_score: result.awayScore,
    match_events: { events: result.events, stats: result.stats, motm: result.manOfTheMatch },
    status: "finished",
  }).eq("id", matchId).eq("status", "scheduled"); // çift işlemeyi önle

  if (updErr) return { error: updErr.message };

  // Puan tablosu
  await applyStanding(svc, match.league_id, home.teamId, result.homeScore, result.awayScore);
  await applyStanding(svc, match.league_id, away.teamId, result.awayScore, result.homeScore);

  // CR ödülleri (insan takımlar)
  await rewardTeam(svc, home, result.homeScore, result.awayScore);
  await rewardTeam(svc, away, result.awayScore, result.homeScore);

  return {};
}
