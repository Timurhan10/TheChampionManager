import { redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import { ScoutLevelPanel, ScoutSearch, CountryScout } from "@/components/ScoutingClient";

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Tamamlanıyor…";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}s ${m}dk kaldı` : `${m}dk kaldı`;
}

export default async function ScoutingPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createServiceClient();
  const { data: teamRow } = await supabase.from("teams").select("scout_level").eq("id", team.id).maybeSingle();
  const scoutLevel = (teamRow as any)?.scout_level ?? 1;

  const { data: reports } = await supabase
    .from("scouting_reports")
    .select("id, level, status, completes_at, created_at, target_player_id")
    .eq("scout_team_id", team.id)
    .order("created_at", { ascending: false });

  const all = reports ?? [];
  const playerIds = Array.from(new Set(all.map((r: any) => r.target_player_id)));
  const { data: pRows } = playerIds.length
    ? await supabase.from("players").select("id, name, position").in("id", playerIds)
    : { data: [] as any[] };
  const pById = new Map((pRows ?? []).map((p: any) => [p.id, p]));

  const active = all.filter((r: any) => r.status === "pending");
  const completed = all.filter((r: any) => r.status === "completed");

  const LEVEL_LABEL: Record<string, string> = { basic: "Temel", detailed: "Detaylı", full: "Tam" };

  return (
    <>
      <PageTopBar title="Scouting Merkezi" subtitle="Yetenek keşfi" />
      <div className="flex-1 overflow-y-auto p-[22px] space-y-5">
        <ScoutLevelPanel level={scoutLevel} />

        <CountryScout />

        <div className="grid grid-cols-3 gap-5">
          {/* Aktif görevler */}
          <div>
            <div className="section-label mb-2">Aktif Görevler ({active.length})</div>
            <div className="space-y-2">
              {active.length === 0 && <div className="bg-panel border border-border-cm rounded-card p-4 text-center text-text-muted text-sm">Aktif görev yok.</div>}
              {active.map((r: any) => {
                const p = pById.get(r.target_player_id);
                return (
                  <div key={r.id} className="bg-panel border border-border-cm rounded-card p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold">{p?.name ?? "—"}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-cm/15 text-blue-cm-bright">{LEVEL_LABEL[r.level]}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-panel-inset overflow-hidden mb-1.5">
                      <div className="h-full bg-blue-cm rounded-full animate-pulse" style={{ width: "60%" }} />
                    </div>
                    <div className="text-xs text-text-muted">{timeLeft(r.completes_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Yeni scout */}
          <ScoutSearch />

          {/* Tamamlanan raporlar */}
          <div>
            <div className="section-label mb-2">Tamamlanan Raporlar ({completed.length})</div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {completed.length === 0 && <div className="bg-panel border border-border-cm rounded-card p-4 text-center text-text-muted text-sm">Henüz rapor yok.</div>}
              {completed.map((r: any) => {
                const p = pById.get(r.target_player_id);
                return (
                  <Link key={r.id} href={`/player/${r.target_player_id}`}
                    className="block bg-panel border border-border-cm rounded-card p-3 border-l-2 border-l-emerald hover:bg-panel-inset/40">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold flex items-center gap-2">{p?.name ?? "—"}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald/15 text-emerald">{LEVEL_LABEL[r.level]}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">{new Date(r.created_at).toLocaleDateString("tr-TR")} · Raporu gör →</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
