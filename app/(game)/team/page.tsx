import { redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import TeamResetButton from "@/components/TeamResetButton";
import PlayerNameEdit from "@/components/PlayerNameEdit";
import { getTeamEditability } from "@/lib/team-guard";
import { averageRating } from "@/lib/player-generator";
import { POSITION_COLORS, POSITION_LABELS, ratingColor } from "@/lib/attributes";
import { formatCR, formatNumber } from "@/lib/utils";
import type { Player, Position } from "@/types/game";

const ORDER: Position[] = ["GK", "DF", "MF", "FW"];

export default async function TeamPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createServiceClient();
  const [{ data: players }, editability] = await Promise.all([
    supabase.from("players").select("*").eq("team_id", team.id).order("position"),
    getTeamEditability(supabase, team.id),
  ]);

  const list = (players ?? []) as Player[];
  const editable = editability.editable;
  const resetReason = editability.inActiveLeague ? "lig başladı" : editability.hasTransfers ? "transfer yapıldı" : undefined;
  const totalValue = list.reduce((sum, p) => sum + (p.value_cr ?? 0), 0);

  const grouped: Record<Position, Player[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of list) grouped[p.position].push(p);

  return (
    <>
      <PageTopBar title="Takım Kadrosu" subtitle={`${list.length} oyuncu`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        {/* Üst özet */}
        <div className="flex items-center gap-6 bg-panel border border-border-cm rounded-card px-5 py-4 mb-5 shadow-card">
          <Stat label="Oyuncu" value={`${list.length}`} />
          <Divider />
          <Stat label="Toplam Kadro Değeri" value={formatCR(totalValue)} accent="#10B981" />
          <Divider />
          <Stat label="Ortalama Yaş" value={`${list.length ? Math.round(list.reduce((s, p) => s + p.age, 0) / list.length) : 0}`} />
          <div className="ml-auto flex items-center gap-2">
            <TeamResetButton editable={editable} reason={resetReason} />
            <Link href="/scouting" className="border border-blue-cm text-blue-cm-bright text-sm px-3 py-2 rounded-lg hover:bg-blue-cm/10">Scout Et</Link>
            <Link href="/transfer-market" className="bg-emerald text-emerald-ink text-sm font-semibold px-3 py-2 rounded-lg hover:bg-emerald-bright">Transfer Pazarı</Link>
          </div>
        </div>
        {editable && <div className="text-xs text-text-muted mb-4 -mt-3">İsimleri düzenleyebilir veya takımı sıfırlayabilirsin (lig henüz başlamadı, transfer yok).</div>}

        {/* Pozisyona göre gruplu liste */}
        {ORDER.map((pos) => (
          grouped[pos].length > 0 && (
            <div key={pos} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: POSITION_COLORS[pos].color }} />
                <span className="section-label" style={{ color: POSITION_COLORS[pos].color }}>
                  {POSITION_LABELS[pos]} ({grouped[pos].length})
                </span>
              </div>
              <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
                {/* Başlık */}
                <div className="grid grid-cols-[1.7fr_60px_70px_96px_76px] gap-2 px-4 py-2.5 border-b border-border-cm text-[10.5px] font-bold tracking-wide text-text-faint uppercase">
                  <span>İsim</span><span>Yaş</span><span>Rating</span><span>Değer</span><span></span>
                </div>
                {grouped[pos].map((p) => {
                  const rating = averageRating(p);
                  return (
                    <div key={p.id} className="grid grid-cols-[1.7fr_60px_70px_96px_76px] gap-2 px-4 py-2.5 items-center border-b border-border-soft last:border-0 hover:bg-panel-inset/50">
                      <div className="flex items-center gap-2.5">
                        <span className="num text-text-faint text-xs w-5 text-center shrink-0">{p.shirt_number ?? "—"}</span>
                        <span className="w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[pos].bg, color: POSITION_COLORS[pos].color }}>{pos}</span>
                        <span className="text-sm font-medium">{p.name}</span>
                        {editable && <PlayerNameEdit playerId={p.id} name={p.name} />}
                        {p.is_youth_academy && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-amber">ALT YAPI</span>}
                      </div>
                      <span className="text-sm text-text-2 num">{p.age}</span>
                      <span className="font-display font-extrabold text-base" style={{ color: ratingColor(rating) }}>{rating}</span>
                      <span className="text-sm text-text-2">{formatNumber(p.value_cr)} CR</span>
                      <Link href={`/player/${p.id}`} className="text-xs text-center border border-border-cm py-1 rounded hover:bg-panel-inset">Profil</Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ))}

        {list.length === 0 && (
          <div className="text-center py-20 text-text-muted">Henüz oyuncu yok.</div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="section-label mb-0.5">{label}</div>
      <div className="font-display font-extrabold text-xl" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-9 bg-border-cm" />;
}
