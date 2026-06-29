import { notFound, redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import StartLeagueButton from "@/components/StartLeagueButton";
import { LEAGUE_SIZE } from "@/lib/constants";
import { teamBadge } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Standing {
  team_id: string;
  name: string;
  is_ai: boolean;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
}

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createClient();
  const { data: league } = await supabase.from("leagues").select("*").eq("id", params.id).maybeSingle();
  if (!league) notFound();

  // Puan tablosu
  const { data: lt } = await supabase
    .from("league_teams")
    .select("team_id, points, wins, draws, losses, goals_for, goals_against, teams(name, is_ai)")
    .eq("league_id", params.id);

  const standings: Standing[] = (lt ?? []).map((r: any) => ({
    team_id: r.team_id,
    name: r.teams?.name ?? "—",
    is_ai: r.teams?.is_ai ?? false,
    points: r.points, wins: r.wins, draws: r.draws, losses: r.losses,
    goals_for: r.goals_for, goals_against: r.goals_against,
  }));

  standings.sort((a, b) =>
    b.points - a.points ||
    (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) ||
    b.goals_for - a.goals_for ||
    a.name.localeCompare(b.name)
  );

  // Fikstür
  const { data: matchRows } = await supabase
    .from("matches")
    .select("id, week, scheduled_at, status, home_score, away_score, home_team_id, away_team_id")
    .eq("league_id", params.id)
    .order("week")
    .order("scheduled_at");

  const teamName: Record<string, string> = {};
  for (const s of standings) teamName[s.team_id] = s.name;

  // Haftalara grupla
  const byWeek: Record<number, any[]> = {};
  for (const m of matchRows ?? []) {
    (byWeek[m.week] ??= []).push(m);
  }
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  const isCreator = league.creator_id === team.user_id;

  return (
    <>
      <PageTopBar title={league.name} subtitle={`Sezon ${league.season_number}`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        {league.status === "waiting" && (
          <div className="mb-5">
            {isCreator ? (
              <StartLeagueButton leagueId={league.id} teamCount={standings.length} size={LEAGUE_SIZE} />
            ) : (
              <div className="bg-panel border border-border-cm rounded-card p-4 text-sm text-text-2">
                Lig bekliyor — kurucu başlatınca fikstür oluşturulur. ({standings.length}/{LEAGUE_SIZE} takım)
                <span className="ml-2 text-text-faint">Davet kodu: <span className="font-display tracking-wider text-text-2">{league.invite_code}</span></span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-[1.5fr_1fr] gap-5">
          {/* Puan Tablosu */}
          <div>
            <div className="section-label mb-2">Puan Tablosu</div>
            <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
              <div className="grid grid-cols-[28px_1fr_28px_28px_28px_28px_36px_36px_36px_34px] gap-1 px-3 py-2.5 border-b border-border-cm text-[10px] font-bold text-text-faint uppercase">
                <span>#</span><span>Takım</span><span className="text-center">O</span><span className="text-center">G</span>
                <span className="text-center">B</span><span className="text-center">M</span><span className="text-center">AG</span>
                <span className="text-center">YG</span><span className="text-center">AV</span><span className="text-center">P</span>
              </div>
              {standings.map((s, i) => {
                const pos = i + 1;
                const played = s.wins + s.draws + s.losses;
                const gd = s.goals_for - s.goals_against;
                const isOwn = s.team_id === team.id;
                const promo = pos <= 3;
                const releg = pos >= LEAGUE_SIZE - 1;
                return (
                  <div key={s.team_id}
                    className={cn(
                      "grid grid-cols-[28px_1fr_28px_28px_28px_28px_36px_36px_36px_34px] gap-1 px-3 py-2.5 items-center text-sm border-b border-border-soft last:border-0 relative",
                      isOwn && "bg-emerald/[0.12]",
                      promo && !isOwn && "bg-emerald/[0.04]",
                      releg && !isOwn && "bg-danger/[0.05]"
                    )}>
                    {isOwn && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald" />}
                    <span className="font-display font-bold text-center" style={{ color: promo ? "#10B981" : releg ? "#EF4444" : undefined }}>{pos}</span>
                    <span className={cn("flex items-center gap-2 truncate", isOwn && "text-emerald font-semibold")}>
                      <span className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center bg-panel-inset shrink-0">{teamBadge(s.name)}</span>
                      <span className="truncate">{s.name}</span>
                      {s.is_ai && <span className="text-[8px] text-text-faint">AI</span>}
                    </span>
                    <span className="text-center text-text-2 num">{played}</span>
                    <span className="text-center text-text-2 num">{s.wins}</span>
                    <span className="text-center text-text-2 num">{s.draws}</span>
                    <span className="text-center text-text-2 num">{s.losses}</span>
                    <span className="text-center text-text-2 num">{s.goals_for}</span>
                    <span className="text-center text-text-2 num">{s.goals_against}</span>
                    <span className="text-center num" style={{ color: gd > 0 ? "#10B981" : gd < 0 ? "#EF4444" : "#94A3B8" }}>{gd > 0 ? `+${gd}` : gd}</span>
                    <span className="text-center font-display font-extrabold">{s.points}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-2 text-[11px] text-text-faint">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald" /> Terfi (1-3)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger" /> Küme düşme ({LEAGUE_SIZE - 1}-{LEAGUE_SIZE})</span>
            </div>
          </div>

          {/* Fikstür */}
          <div>
            <div className="section-label mb-2">Fikstür</div>
            {weeks.length === 0 ? (
              <div className="bg-panel border border-border-cm rounded-card p-8 text-center text-text-muted text-sm">
                Lig başlayınca fikstür burada görünecek.
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {weeks.map((w) => (
                  <div key={w}>
                    <div className="text-[11px] font-bold text-text-faint uppercase mb-1.5">Hafta {w}</div>
                    <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
                      {byWeek[w].map((m) => {
                        const finished = m.status === "finished";
                        const homeWin = finished && m.home_score > m.away_score;
                        const awayWin = finished && m.away_score > m.home_score;
                        return (
                          <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2 border-b border-border-soft last:border-0 text-sm">
                            <span className={cn("text-right truncate", homeWin && "text-emerald font-semibold")}>{teamName[m.home_team_id] ?? "—"}</span>
                            <span className="px-2 py-0.5 rounded bg-panel-inset text-xs font-display font-bold min-w-[48px] text-center">
                              {finished ? `${m.home_score}-${m.away_score}` : new Date(m.scheduled_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
                            </span>
                            <span className={cn("truncate", awayWin && "text-emerald font-semibold")}>{teamName[m.away_team_id] ?? "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
