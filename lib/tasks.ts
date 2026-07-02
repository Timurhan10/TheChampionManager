// Günlük görevler: statik tanımlar; ilerleme MEVCUT verilerden hesaplanır
// (ayrı sayaç tablosu yok — kaynak veriler zaten günlük damgalı).
// Claim doğrulaması sunucuda: /api/tasks/claim aynı hesabı yapar.
import type { SupabaseClient } from "@supabase/supabase-js";
import { utcDayStart, utcDayKey } from "./utils";

export { utcDayStart, utcDayKey };

export interface TaskDef {
  key: string;
  title: string;
  description: string;
  target: number;
  rewardCr: number;
  rewardCmp: number;
}

export const DAILY_TASKS: TaskDef[] = [
  { key: "train_3", title: "3 antrenman yap", description: "Bugün 3 antrenman hakkının hepsini kullan.", target: 3, rewardCr: 3000, rewardCmp: 15 },
  { key: "win_match", title: "Lig maçı kazan", description: "Bugün bir lig maçı kazan.", target: 1, rewardCr: 5000, rewardCmp: 25 },
  { key: "sell_player", title: "Oyuncu sat", description: "Bugün bir oyuncu satışı tamamla.", target: 1, rewardCr: 2000, rewardCmp: 10 },
  { key: "scout_start", title: "Scout görevi başlat", description: "Bugün bir oyuncuyu scout etmeye başla.", target: 1, rewardCr: 2000, rewardCmp: 10 },
  { key: "play_friendly", title: "Hazırlık maçı oyna", description: "Bugün bir hazırlık maçı oyna (sonuç fark etmez).", target: 1, rewardCr: 2500, rewardCmp: 10 },
];

export function taskByKey(key: string): TaskDef | undefined {
  return DAILY_TASKS.find((t) => t.key === key);
}

// Takımın bugünkü ilerlemesi (görev anahtarı → sayı).
export async function computeTaskProgress(
  svc: SupabaseClient,
  teamId: string,
): Promise<Record<string, number>> {
  const iso = utcDayStart().toISOString();

  const [trainings, leagueMatches, sales, scouts, friendlies] = await Promise.all([
    svc.from("training_sessions").select("id", { count: "exact", head: true })
      .eq("team_id", teamId).gte("created_at", iso),
    svc.from("matches").select("home_team_id, away_team_id, home_score, away_score")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq("status", "finished").not("league_id", "is", null).gte("played_at", iso),
    svc.from("transfers").select("id", { count: "exact", head: true })
      .eq("from_team_id", teamId).eq("status", "accepted").gte("resolved_at", iso),
    svc.from("scouting_reports").select("id", { count: "exact", head: true })
      .eq("scout_team_id", teamId).gte("created_at", iso),
    svc.from("matches").select("id", { count: "exact", head: true })
      .eq("home_team_id", teamId).is("league_id", null).gte("created_at", iso),
  ]);

  const wins = (leagueMatches.data ?? []).filter((m: any) =>
    m.home_team_id === teamId
      ? (m.home_score ?? 0) > (m.away_score ?? 0)
      : (m.away_score ?? 0) > (m.home_score ?? 0)
  ).length;

  return {
    train_3: trainings.count ?? 0,
    win_match: wins,
    sell_player: sales.count ?? 0,
    scout_start: scouts.count ?? 0,
    play_friendly: friendlies.count ?? 0,
  };
}

// Bugün claim edilmiş görev anahtarları.
export async function getClaimedToday(svc: SupabaseClient, teamId: string): Promise<Set<string>> {
  const { data } = await svc.from("task_claims").select("task_key")
    .eq("team_id", teamId).eq("day", utcDayKey());
  return new Set((data ?? []).map((r: any) => r.task_key));
}
