import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import PageTopBar from "@/components/PageTopBar";
import MatchCanvas from "@/components/MatchCanvas";
import PreMatch from "@/components/PreMatch";
import { teamBadge, hexToNumber } from "@/lib/utils";
import type { MatchEvent } from "@/types/game";

export default async function MatchPage({ params }: { params: { id: string } }) {
  const { team, authId } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createServiceClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, status, home_score, away_score, match_events, home_team_id, away_team_id, scheduled_at, week")
    .eq("id", params.id)
    .maybeSingle();
  if (!match) notFound();

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, primary_color")
    .in("id", [match.home_team_id, match.away_team_id]);
  const byId = new Map((teamRows ?? []).map((t: any) => [t.id, t]));
  const home = byId.get(match.home_team_id);
  const away = byId.get(match.away_team_id);
  const homeName = home?.name ?? "Ev Sahibi";
  const awayName = away?.name ?? "Deplasman";

  // Maç öncesi
  if (match.status === "scheduled") {
    // Kullanıcının takımı sahadaysa ya da admin ise maçı şimdi oynayabilir.
    const isParticipant = team.id === match.home_team_id || team.id === match.away_team_id;
    const canPlay = isParticipant || (authId ? await isAdmin(supabase, authId) : false);
    return (
      <>
        <PageTopBar title="Maç" subtitle={`Hafta ${match.week ?? "-"}`} />
        <PreMatch scheduledAt={match.scheduled_at} homeName={homeName} awayName={awayName} matchId={match.id} canPlay={canPlay} />
      </>
    );
  }

  // Oynanmış / canlı → replay
  const me = match.match_events as any;
  const events: MatchEvent[] = Array.isArray(me) ? me : me?.events ?? [];
  const stats = me?.stats ?? null;

  return (
    <>
      <PageTopBar title="Canlı Maç" subtitle={`Hafta ${match.week ?? "-"}`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        {/* Takım başlığı */}
        <div className="grid grid-cols-3 items-center mb-4">
          <div className="flex items-center gap-2 justify-end">
            <span className="font-display font-bold">{homeName}</span>
            <span className="w-8 h-8 rounded-lg bg-blue-cm/20 text-blue-cm-bright flex items-center justify-center text-xs font-bold">{teamBadge(homeName)}</span>
          </div>
          <div className="text-center text-xs text-text-faint">EV SAHİBİ — DEPLASMAN</div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-danger/20 text-danger flex items-center justify-center text-xs font-bold">{teamBadge(awayName)}</span>
            <span className="font-display font-bold">{awayName}</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-5">
          <MatchCanvas
            events={events}
            homeColor={hexToNumber(home?.primary_color ?? "#3B82F6")}
            awayColor={hexToNumber(away?.primary_color ?? "#EF4444")}
          />

          {/* İstatistikler */}
          <div>
            <div className="section-label mb-2">Maç İstatistikleri</div>
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
            <Link href={`/match/${match.id}/result`} className="block text-center mt-4 border border-border-cm text-sm py-2 rounded-lg hover:bg-panel-inset">
              Maç Özeti →
            </Link>
          </div>
        </div>
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
