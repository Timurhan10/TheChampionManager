// Bir ligi GÜVENLİ siler (admin). FK-güvenli sırayla:
//  - O lige özel AI takımları + oyuncuları + maçları + ilgili transfer/scout kayıtları silinir.
//  - İnsan takımları/oyuncuları/parası KORUNUR; yalnızca lig üyelikleri (cascade) kalkar.
//  - players.team_id SET NULL kirliliği önlemek için AI oyuncuları AÇIKÇA silinir.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DeleteLeagueResult {
  error?: string;
  deletedAiTeams?: number;
  deletedAiPlayers?: number;
  deletedMatches?: number;
}

export async function deleteLeagueCascade(svc: SupabaseClient, leagueId: string): Promise<DeleteLeagueResult> {
  const { data: league } = await svc.from("leagues").select("id, name").eq("id", leagueId).maybeSingle();
  if (!league) return { error: "Lig bulunamadı." };

  // Ligdeki takımlar → AI olanları ayır (insan takımları SİLİNMEZ)
  const { data: lt } = await svc.from("league_teams").select("team_id").eq("league_id", leagueId);
  const teamIds = (lt ?? []).map((r: any) => r.team_id).filter(Boolean) as string[];

  let aiTeamIds: string[] = [];
  if (teamIds.length) {
    const { data: aiTeams } = await svc.from("teams").select("id").eq("is_ai", true).in("id", teamIds);
    aiTeamIds = (aiTeams ?? []).map((t: any) => t.id);
  }

  // AI oyuncu id'leri
  let aiPlayerIds: string[] = [];
  if (aiTeamIds.length) {
    const { data: aiPlayers } = await svc.from("players").select("id").in("team_id", aiTeamIds);
    aiPlayerIds = (aiPlayers ?? []).map((p: any) => p.id);
  }

  // a) Maçlar (matches.league_id cascade YOK → lig silmeden önce)
  const matchDel = await svc.from("matches").delete().eq("league_id", leagueId).select("id");
  const deletedMatches = matchDel.data?.length ?? 0;

  // b) AI takım/oyuncularına bağlı transferler
  if (aiTeamIds.length) {
    await svc.from("transfers").delete().in("from_team_id", aiTeamIds);
    await svc.from("transfers").delete().in("to_team_id", aiTeamIds);
  }
  if (aiPlayerIds.length) {
    await svc.from("transfers").delete().in("player_id", aiPlayerIds);
  }

  // c) Scout raporları (AI oyuncu/takım)
  if (aiPlayerIds.length) {
    await svc.from("scouting_reports").delete().in("target_player_id", aiPlayerIds);
  }
  if (aiTeamIds.length) {
    await svc.from("scouting_reports").delete().in("scout_team_id", aiTeamIds);
  }

  // d) Taktik + alt yapı (AI takım)
  if (aiTeamIds.length) {
    await svc.from("tactics").delete().in("team_id", aiTeamIds);
    await svc.from("youth_academy").delete().in("team_id", aiTeamIds);
  }

  // e) Lig üyelikleri (AI üyelikleri de gitsin ki AI takımlar silinebilsin)
  await svc.from("league_teams").delete().eq("league_id", leagueId);

  // f) AI oyuncuları AÇIKÇA sil (SET NULL serbest-ajan kirliliği olmasın)
  let deletedAiPlayers = 0;
  if (aiTeamIds.length) {
    const pDel = await svc.from("players").delete().in("team_id", aiTeamIds).select("id");
    deletedAiPlayers = pDel.data?.length ?? 0;
  }

  // g) AI takımları sil
  let deletedAiTeams = 0;
  if (aiTeamIds.length) {
    const tDel = await svc.from("teams").delete().in("id", aiTeamIds).select("id");
    deletedAiTeams = tDel.data?.length ?? 0;
  }

  // h) Ligi sil (artık maç/üyelik referansı yok)
  const { error: lDelErr } = await svc.from("leagues").delete().eq("id", leagueId);
  if (lDelErr) return { error: lDelErr.message };

  return { deletedAiTeams, deletedAiPlayers, deletedMatches };
}
