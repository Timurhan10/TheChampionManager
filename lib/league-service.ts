// Lig aktivasyonu: eksik slotları AI ile doldur, fikstür üret, status='active'.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAGUE_SIZE } from "./constants";
import { generateAiTeamName, generateAiSquad, randomTeamColors } from "./ai-team-generator";
import { generateSchedule, type MatchDay } from "./schedule-generator";
import { topUpFreeAgents, listAiPlayersForSale } from "./free-agents";

// Verilen lig için AI takımları üretip LEAGUE_SIZE'a tamamlar, fikstürü oluşturur.
export async function activateLeague(svc: SupabaseClient, leagueId: string): Promise<{ error?: string }> {
  const { data: league } = await svc.from("leagues").select("*").eq("id", leagueId).maybeSingle();
  if (!league) return { error: "Lig bulunamadı." };
  if (league.status !== "waiting") return { error: "Lig zaten başlatılmış." };

  // Mevcut takımlar
  const { data: lt } = await svc.from("league_teams").select("team_id").eq("league_id", leagueId);
  const currentTeamIds: string[] = (lt ?? []).map((r: any) => r.team_id);

  // İsim çakışmasını önlemek için mevcut takım isimleri
  const { data: existingTeams } = await svc.from("teams").select("name");
  const usedNames = new Set<string>((existingTeams ?? []).map((t: any) => t.name));

  const slotsToFill = LEAGUE_SIZE - currentTeamIds.length;
  const newTeamIds: string[] = [];

  for (let i = 0; i < slotsToFill; i++) {
    const colors = randomTeamColors();
    const { data: aiTeam, error: teamErr } = await svc
      .from("teams")
      .insert({
        user_id: null,
        name: generateAiTeamName(usedNames),
        primary_color: colors.primary,
        secondary_color: colors.secondary,
        is_ai: true,
      })
      .select()
      .single();
    if (teamErr || !aiTeam) return { error: teamErr?.message ?? "AI takımı oluşturulamadı." };

    // AI kadrosu
    const squad = generateAiSquad();
    const playerRows = squad.map((p, i) => ({
      team_id: aiTeam.id,
      name: p.name,
      age: p.age,
      position: p.position,
      is_youth_academy: false,
      potential: p.potential,
      value_cr: p.value_cr,
      shirt_number: i + 1,
      ...p.attributes,
    }));
    await svc.from("players").insert(playerRows);
    // Varsayılan taktik (AI: dengeli 4-4-2 orta pressing)
    await svc.from("tactics").insert({ team_id: aiTeam.id, formation: "4-4-2" });

    // AI takımı 2-3 oyuncusunu satışa çıkarsın
    await listAiPlayersForSale(svc, aiTeam.id);

    newTeamIds.push(aiTeam.id);
  }

  // AI takımlarını lige ekle
  if (newTeamIds.length > 0) {
    await svc.from("league_teams").insert(
      newTeamIds.map((tid) => ({ league_id: leagueId, team_id: tid }))
    );
  }

  // Serbest oyuncu havuzunu hedefe tamamla (transfer pazarı boş kalmasın)
  await topUpFreeAgents(svc);

  const allTeamIds = [...currentTeamIds, ...newTeamIds];

  // Fikstür üret
  const matches = generateSchedule(
    allTeamIds,
    league.match_day_1 as MatchDay,
    league.match_day_2 as MatchDay,
    String(league.match_time).slice(0, 5)
  ).map((m) => ({ ...m, league_id: leagueId, status: "scheduled" as const }));

  const { error: matchErr } = await svc.from("matches").insert(matches);
  if (matchErr) return { error: matchErr.message };

  // Aktif et
  const { error: statusErr } = await svc.from("leagues").update({ status: "active" }).eq("id", leagueId);
  if (statusErr) return { error: statusErr.message };

  return {};
}
