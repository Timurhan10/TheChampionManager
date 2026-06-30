import type { SupabaseClient } from "@supabase/supabase-js";

// Takımın "düzenlenebilir" olup olmadığını döner: aktif ligde değil VE hiç transfer yapılmamış.
// (İsim düzenleme ve takım sıfırlama bu koşullarda serbest.)
export async function getTeamEditability(
  svc: SupabaseClient,
  teamId: string
): Promise<{ inActiveLeague: boolean; hasTransfers: boolean; editable: boolean }> {
  // Aktif ligde mi?
  const { data: memberships } = await svc
    .from("league_teams")
    .select("leagues(status)")
    .eq("team_id", teamId);
  const inActiveLeague = (memberships ?? []).some((m: any) => m.leagues?.status === "active");

  // Bu takımı içeren herhangi bir transfer var mı? (alıcı veya satıcı)
  const { count } = await svc
    .from("transfers")
    .select("id", { count: "exact", head: true })
    .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`);
  const hasTransfers = (count ?? 0) > 0;

  return { inActiveLeague, hasTransfers, editable: !inActiveLeague && !hasTransfers };
}
