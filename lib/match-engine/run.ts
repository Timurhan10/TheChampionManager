// Bir maçı simüle edip sonucu kalıcılaştırır: skor, olaylar, puan tablosu, CR ödülleri.
import type { SupabaseClient } from "@supabase/supabase-js";
import { simulateMatch, type EngineTeam, type PlayerRating, type SimResult } from "./simulator";
import { MATCH_REWARDS } from "@/lib/constants";
import { STYLE_PRESETS, pickBestStyleForSquad } from "@/lib/tactic-styles";
import type { Player, Tactics } from "@/types/game";

// Oyuncu reytinglerini biriktirir. matches_played/rating_sum kolonları yoksa (migration 0005
// öncesi) sessizce atlar; maç tamamlanması bozulmaz.
async function persistRatings(svc: SupabaseClient, ratings: PlayerRating[]) {
  if (!ratings.length) return;
  try {
    const ids = ratings.map((r) => r.playerId);
    const { data: rows, error } = await svc.from("players").select("id, matches_played, rating_sum").in("id", ids);
    if (error) return;
    const cur = new Map((rows ?? []).map((r: any) => [r.id, r]));
    for (const r of ratings) {
      const c = cur.get(r.playerId);
      const mp = (c?.matches_played ?? 0) + 1;
      const rs = Number(c?.rating_sum ?? 0) + r.rating;
      await svc.from("players").update({ matches_played: mp, rating_sum: rs }).eq("id", r.playerId);
    }
  } catch {
    // kolon yoksa atla
  }
}

async function loadTeam(svc: SupabaseClient, teamId: string): Promise<EngineTeam> {
  const { data: team } = await svc.from("teams").select("id, name, is_ai, user_id").eq("id", teamId).single();
  const { data: players } = await svc.from("players").select("*").eq("team_id", teamId);
  const { data: tactics } = await svc.from("tactics").select("*").eq("team_id", teamId).maybeSingle();

  const squad = (players ?? []) as Player[];
  let t = (tactics as Tactics) ?? null;

  // AI takımlar kadrolarına en uygun stille oynar (bellekte; DB'ye yazılmaz).
  if ((team?.is_ai ?? true) && !t?.style && squad.length >= 11) {
    const style = pickBestStyleForSquad(squad);
    const preset = STYLE_PRESETS[style].settings;
    t = {
      ...(t ?? { id: "", team_id: teamId, formation: "4-4-2", lineup: {}, substitutes: [], updated_at: "" }),
      mentality: preset.mentality, pressing: preset.pressing, tempo: preset.tempo, pass_style: preset.pass_style,
      style,
      advanced: { width: preset.width, defensive_line: preset.defensive_line, time_wasting: preset.time_wasting ?? false, counter_attack: preset.counter_attack ?? false },
    } as Tactics;
  }

  return {
    teamId,
    name: team?.name ?? "—",
    isAi: team?.is_ai ?? true,
    players: squad,
    tactics: t,
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
  await svc.rpc("add_credits", { uid: t.user_id, delta: reward }); // atomik — tek para kuralı
}

export async function runMatch(svc: SupabaseClient, matchId: string): Promise<{ error?: string; skipped?: boolean; result?: SimResult }> {
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
  const rec = await recordMatchResult(svc, match, home, away, result);
  if (rec.error) return { error: rec.error };
  return { result };
}

// Ortak kayıt kuyruğu: skor+olaylar, reytingler, puan tablosu, ödüller.
async function recordMatchResult(
  svc: SupabaseClient,
  match: { id: string; league_id: string; home_team_id: string; away_team_id: string },
  home: EngineTeam,
  away: EngineTeam,
  result: SimResult,
): Promise<{ error?: string }> {
  const { data: upd, error: updErr } = await svc.from("matches").update({
    home_score: result.homeScore,
    away_score: result.awayScore,
    match_events: { events: result.events, stats: result.stats, motm: result.manOfTheMatch, ratings: result.playerRatings },
    status: "finished",
    played_at: new Date().toISOString(), // günlük "maç kazan" görevi buna bakar
  }).eq("id", match.id).eq("status", "scheduled").select("id"); // çift işlemeyi önle

  if (updErr) return { error: updErr.message };
  if (!upd || upd.length === 0) return { error: "Maç zaten işlenmiş." };

  await persistRatings(svc, result.playerRatings);
  await applyStanding(svc, match.league_id, home.teamId, result.homeScore, result.awayScore);
  await applyStanding(svc, match.league_id, away.teamId, result.awayScore, result.homeScore);
  await rewardTeam(svc, home, result.homeScore, result.awayScore);
  await rewardTeam(svc, away, result.awayScore, result.homeScore);
  return {};
}

// Herhangi bir takımı canlı motor için yükler (lig maçı / lig-takımına-karşı hazırlık).
export async function loadEngineTeam(svc: SupabaseClient, teamId: string): Promise<EngineTeam> {
  return loadTeam(svc, teamId);
}

// İstemcide oynanan canlı lig maçının sonucunu HAFİF doğrulamayla kaydeder.
// (Hobi oyunu: amaç kaba hile/bozulmayı engellemek; sunucu puan tablosunun tek yazarıdır.)
export async function completeMatchWithLiveResult(
  svc: SupabaseClient,
  matchId: string,
  result: SimResult,
): Promise<{ error?: string; skipped?: boolean }> {
  const { data: match } = await svc
    .from("matches")
    .select("id, league_id, home_team_id, away_team_id, status")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "Maç bulunamadı." };
  if (match.status === "finished") return { skipped: true };

  // Temel makullük kontrolleri
  const goalsH = (result.events ?? []).filter((e) => e.type === "goal" && e.team === "home").length;
  const goalsA = (result.events ?? []).filter((e) => e.type === "goal" && e.team === "away").length;
  if (goalsH !== result.homeScore || goalsA !== result.awayScore) return { error: "Sonuç tutarsız (gol/olay uyuşmuyor)." };
  if (result.homeScore + result.awayScore > 10) return { error: "Sonuç makul değil." };
  const s = result.stats;
  if (!s || s.shotsHome > 40 || s.shotsAway > 40 || s.shotsHome < result.homeScore || s.shotsAway < result.awayScore) {
    return { error: "İstatistikler makul değil." };
  }
  if ((result.playerRatings ?? []).length > 44) return { error: "Reyting listesi makul değil." };

  const home = await loadTeam(svc, match.home_team_id);
  const away = await loadTeam(svc, match.away_team_id);
  return recordMatchResult(svc, match, home, away, result);
}
