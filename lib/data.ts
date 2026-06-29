import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameUser, Team } from "@/types/game";

// Geçerli oturum kullanıcısının oyun verisini (users satırı + takımı) getirir.
export async function getGameContext(): Promise<{
  authId: string | null;
  gameUser: GameUser | null;
  team: Team | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authId: null, gameUser: null, team: null };

  const { data: gameUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    authId: user.id,
    gameUser: (gameUser as GameUser) ?? null,
    team: (team as Team) ?? null,
  };
}

// Bir takımın belirtilen oyuncular için scout ettiği (tamamlanmış) attribute key'lerini döner.
export async function getRevealedKeys(
  supabase: SupabaseClient,
  scoutTeamId: string,
  playerIds: string[]
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (playerIds.length === 0) return result;

  const { data: reports } = await supabase
    .from("scouting_reports")
    .select("target_player_id, revealed_attributes")
    .eq("scout_team_id", scoutTeamId)
    .eq("status", "completed")
    .in("target_player_id", playerIds);

  for (const r of reports ?? []) {
    const keys: string[] = (r as any).revealed_attributes?.keys ?? [];
    const set = result.get((r as any).target_player_id) ?? new Set<string>();
    keys.forEach((k) => set.add(k));
    result.set((r as any).target_player_id, set);
  }
  return result;
}
