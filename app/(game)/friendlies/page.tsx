import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import FriendlyMatch from "@/components/FriendlyMatch";
import { hexToNumber } from "@/lib/utils";
import type { Player, Tactics } from "@/types/game";

export const dynamic = "force-dynamic";

export default async function FriendliesPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const svc = createServiceClient();
  const [{ data: history }, { data: players }, { data: tactics }, { data: teamRow }, { data: myLeagues }] = await Promise.all([
    svc.from("matches").select("id, home_score, away_score, match_events, created_at")
      .eq("home_team_id", team.id).is("league_id", null).order("created_at", { ascending: false }).limit(25),
    svc.from("players").select("*").eq("team_id", team.id),
    svc.from("tactics").select("*").eq("team_id", team.id).maybeSingle(),
    svc.from("teams").select("name, primary_color").eq("id", team.id).maybeSingle(),
    svc.from("league_teams").select("league_id").eq("team_id", team.id),
  ]);

  // Ligdeki rakip takımlar (hazırlık maçı için)
  let leagueOpponents: { id: string; name: string }[] = [];
  const leagueIds = (myLeagues ?? []).map((r: any) => r.league_id);
  if (leagueIds.length) {
    const { data: lt } = await svc.from("league_teams").select("team_id").in("league_id", leagueIds).neq("team_id", team.id);
    const oppIds = Array.from(new Set((lt ?? []).map((r: any) => r.team_id)));
    if (oppIds.length) {
      const { data: oppTeams } = await svc.from("teams").select("id, name").in("id", oppIds);
      leagueOpponents = (oppTeams ?? []) as { id: string; name: string }[];
    }
  }

  const friendlies = (history ?? []).filter((m: any) => (m.match_events as any)?.friendly);

  return (
    <>
      <PageTopBar title="Hazırlık Maçları" subtitle="İstediğin zaman AI'ya karşı maç oyna — sonuçlar reytingi, parayı veya puanı etkilemez" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <div className="grid grid-cols-[1fr_340px] gap-5 max-w-5xl">
          <FriendlyMatch
            canPlay={(players ?? []).length >= 11}
            players={(players ?? []) as Player[]}
            tactics={(tactics as Tactics) ?? null}
            teamName={teamRow?.name ?? "Takımım"}
            homeColor={hexToNumber(teamRow?.primary_color ?? "#3B82F6")}
            leagueOpponents={leagueOpponents}
          />

          {/* Geçmiş */}
          <div>
            <div className="section-label mb-2">Tüm Hazırlık Maçları ({friendlies.length})</div>
            <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
              {friendlies.length === 0 && (
                <div className="px-4 py-8 text-center text-text-muted text-sm">Henüz hazırlık maçı yok.</div>
              )}
              {friendlies.map((m: any) => {
                const ev = m.match_events as any;
                const hs = m.home_score ?? 0, as = m.away_score ?? 0;
                const win = hs > as, draw = hs === as;
                const tag = win ? { t: "G", c: "#10B981" } : draw ? { t: "B", c: "#F59E0B" } : { t: "M", c: "#EF4444" };
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-soft last:border-0">
                    <span className="w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0"
                      style={{ background: `${tag.c}22`, color: tag.c }}>{tag.t}</span>
                    <span className="text-sm truncate flex-1">{ev?.opponentName ?? "Rakip"}</span>
                    <span className="font-display font-bold tabular-nums text-sm">{hs} - {as}</span>
                    <span className="text-[11px] text-text-faint shrink-0">{new Date(m.created_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
