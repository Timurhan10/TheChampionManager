import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import { teamBadge, cn } from "@/lib/utils";
import type { MatchEvent } from "@/types/game";

const EVENT_TAG: Record<string, { label: string; color: string }> = {
  goal: { label: "GOL", color: "#10B981" },
  yellow: { label: "SK", color: "#F59E0B" },
  red: { label: "KRT", color: "#EF4444" },
  sub: { label: "DEĞ", color: "#3B82F6" },
  half_time: { label: "İY", color: "#94A3B8" },
  full_time: { label: "MS", color: "#94A3B8" },
};

export default async function MatchResultPage({ params }: { params: { id: string } }) {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, status, home_score, away_score, match_events, home_team_id, away_team_id, scheduled_at, week")
    .eq("id", params.id)
    .maybeSingle();

  if (!match) notFound();

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [match.home_team_id, match.away_team_id]);
  const nameById = new Map((teamRows ?? []).map((t: any) => [t.id, t.name]));
  const homeName = nameById.get(match.home_team_id) ?? "Ev Sahibi";
  const awayName = nameById.get(match.away_team_id) ?? "Deplasman";
  const me = match.match_events as any;
  const events: MatchEvent[] = Array.isArray(me) ? me : me?.events ?? [];
  const stats = me?.stats ?? null;
  const motm = me?.motm ?? null;
  const ratings: { name: string; team: "home" | "away"; rating: number }[] = me?.ratings ?? [];

  if (match.status !== "finished") {
    return (
      <>
        <PageTopBar title="Maç" subtitle={`Hafta ${match.week ?? "-"}`} />
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="font-display font-bold text-xl mb-1">{homeName} vs {awayName}</div>
          <p className="text-text-muted text-sm">Bu maç henüz oynanmadı.</p>
          <p className="text-text-faint text-xs mt-1">{new Date(match.scheduled_at).toLocaleString("tr-TR")}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTopBar title="Maç Sonucu" subtitle={`Hafta ${match.week ?? "-"}`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        {/* Skor başlığı */}
        <div className="bg-gradient-to-r from-panel to-panel-inset border border-border-cm rounded-card p-6 mb-5 shadow-card">
          <div className="grid grid-cols-3 items-center">
            <div className="flex items-center gap-3 justify-end">
              <span className="font-display font-bold text-xl text-right">{homeName}</span>
              <span className="w-10 h-10 rounded-lg bg-blue-cm/20 text-blue-cm-bright flex items-center justify-center font-bold text-sm">{teamBadge(homeName)}</span>
            </div>
            <div className="text-center font-display font-extrabold text-4xl">
              {match.home_score} <span className="text-text-faint">-</span> {match.away_score}
            </div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-danger/20 text-danger flex items-center justify-center font-bold text-sm">{teamBadge(awayName)}</span>
              <span className="font-display font-bold text-xl">{awayName}</span>
            </div>
          </div>
          {motm && (
            <div className="text-center mt-4 text-sm text-text-muted">
              ⭐ Maçın Adamı: <span className="text-amber font-semibold">{motm.name}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-5">
          {/* Olay feed'i */}
          <div>
            <div className="section-label mb-2">Maç Olayları</div>
            <div className="bg-panel border border-border-cm rounded-card divide-y divide-border-soft">
              {events.map((e, i) => {
                const tag = EVENT_TAG[e.type] ?? EVENT_TAG.full_time;
                return (
                  <div key={i} className={cn("flex items-center gap-3 px-4 py-2.5", (e.type === "half_time" || e.type === "full_time") && "bg-panel-inset/50")}>
                    <span className="font-display font-bold text-sm w-8 text-text-2">{e.minute}'</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${tag.color}22`, color: tag.color }}>{tag.label}</span>
                    <span className={cn("text-sm", e.team === "away" ? "text-text-2" : "")}>{e.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* İstatistikler */}
          <div>
            <div className="section-label mb-2">İstatistikler</div>
            {stats ? (
              <div className="bg-panel border border-border-cm rounded-card p-5 space-y-4">
                <StatBar label="Topla Oynama" home={stats.possessionHome} away={100 - stats.possessionHome} suffix="%" />
                <StatBar label="Toplam Şut" home={stats.shotsHome} away={stats.shotsAway} />
                <StatBar label="İsabetli Şut" home={stats.sotHome} away={stats.sotAway} />
                <StatBar label="Korner" home={stats.cornersHome} away={stats.cornersAway} />
              </div>
            ) : (
              <div className="bg-panel border border-border-cm rounded-card p-5 text-text-muted text-sm">İstatistik yok.</div>
            )}
            <Link href="/league" className="block text-center mt-4 border border-border-cm text-sm py-2 rounded-lg hover:bg-panel-inset">← Lige Dön</Link>
          </div>
        </div>

        {/* Oyuncu reytingleri */}
        {ratings.length > 0 && (
          <div className="mt-5">
            <div className="section-label mb-2">Oyuncu Reytingleri</div>
            <div className="grid grid-cols-2 gap-5">
              {(["home", "away"] as const).map((side) => (
                <div key={side}>
                  <div className="text-xs font-semibold mb-1.5" style={{ color: side === "home" ? "#60A5FA" : "#EF4444" }}>
                    {side === "home" ? homeName : awayName}
                  </div>
                  <div className="bg-panel border border-border-cm rounded-card divide-y divide-border-soft">
                    {ratings.filter((r) => r.team === side).sort((a, b) => b.rating - a.rating).map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="truncate">{r.name}</span>
                        <span className="font-display font-bold" style={{ color: r.rating >= 7 ? "#10B981" : r.rating >= 5.5 ? "#F59E0B" : "#EF4444" }}>
                          {r.rating.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatBar({ label, home, away, suffix = "" }: { label: string; home: number; away: number; suffix?: string }) {
  const total = home + away || 1;
  const hPct = (home / total) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-display font-bold text-blue-cm-bright">{home}{suffix}</span>
        <span className="text-text-muted text-xs">{label}</span>
        <span className="font-display font-bold text-danger">{away}{suffix}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-panel-inset">
        <div className="bg-blue-cm" style={{ width: `${hPct}%` }} />
        <div className="bg-danger" style={{ width: `${100 - hPct}%` }} />
      </div>
    </div>
  );
}
