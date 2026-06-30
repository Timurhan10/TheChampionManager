import { redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import LeagueActions from "@/components/LeagueActions";
import { LEAGUE_SIZE } from "@/lib/constants";

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  waiting: { text: "Bekliyor", color: "#F59E0B" },
  active: { text: "Aktif", color: "#10B981" },
  finished: { text: "Bitti", color: "#94A3B8" },
};

export default async function LeaguePage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createClient();
  const { data: memberships } = await supabase
    .from("league_teams")
    .select("league_id, leagues(id, name, status, season_number, invite_code)")
    .eq("team_id", team.id);

  const leagues = (memberships ?? [])
    .map((m: any) => m.leagues)
    .filter(Boolean);

  // Her lig için takım sayısı — tek sorguda (N+1 yerine)
  const counts: Record<string, number> = {};
  const leagueIds = leagues.map((l: any) => l.id);
  if (leagueIds.length) {
    const { data: ltRows } = await supabase
      .from("league_teams")
      .select("league_id")
      .in("league_id", leagueIds);
    for (const r of ltRows ?? []) counts[(r as any).league_id] = (counts[(r as any).league_id] ?? 0) + 1;
  }

  return (
    <>
      <PageTopBar title="Lig" subtitle="Lig oluştur veya katıl" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <div className="grid grid-cols-[1fr_360px] gap-5">
          {/* Mevcut ligler */}
          <div>
            <div className="section-label mb-3">Liglerim</div>
            {leagues.length === 0 ? (
              <div className="bg-panel border border-border-cm rounded-card p-10 text-center text-text-muted">
                Henüz bir ligde değilsin. Sağdan bir lig oluştur veya davet koduyla katıl.
              </div>
            ) : (
              <div className="space-y-3">
                {leagues.map((lg: any) => {
                  const st = STATUS_LABEL[lg.status] ?? STATUS_LABEL.waiting;
                  return (
                    <Link key={lg.id} href={`/league/${lg.id}`}
                      className="block bg-panel border border-border-cm rounded-card p-4 hover:border-emerald transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display font-bold text-lg">{lg.name}</div>
                          <div className="text-xs text-text-muted mt-0.5">
                            Sezon {lg.season_number} · {counts[lg.id]}/{LEAGUE_SIZE} takım
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {lg.status === "waiting" && (
                            <span className="text-xs text-text-faint">Kod: <span className="font-display tracking-wider text-text-2">{lg.invite_code}</span></span>
                          )}
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-pill" style={{ background: `${st.color}22`, color: st.color }}>
                            {st.text}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Oluştur / Katıl */}
          <LeagueActions />
        </div>
      </div>
    </>
  );
}
