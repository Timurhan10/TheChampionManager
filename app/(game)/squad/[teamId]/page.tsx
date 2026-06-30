import { redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import BackButton from "@/components/BackButton";
import { POSITION_COLORS, POSITION_LABELS } from "@/lib/attributes";
import type { Player, Position } from "@/types/game";

const ORDER: Position[] = ["GK", "DF", "MF", "FW"];

// Herhangi bir takımın kadrosu (rakip dahil). Oyuncuya tıklayınca profil açılır.
export default async function SquadViewPage({ params }: { params: { teamId: string } }) {
  const { team: myTeam } = await getGameContext();
  if (!myTeam) redirect("/onboarding");

  const supabase = createClient();
  const [{ data: team }, { data: players }] = await Promise.all([
    supabase.from("teams").select("id, name, is_ai").eq("id", params.teamId).maybeSingle(),
    supabase.from("players").select("id, name, age, position, is_youth_academy").eq("team_id", params.teamId).order("position"),
  ]);

  if (!team) {
    return (
      <>
        <PageTopBar title="Kadro" subtitle="Bulunamadı" />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <p className="text-text-2 mb-4">Takım bulunamadı.</p>
          <Link href="/league" className="bg-emerald text-emerald-ink font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-bright">Lige Dön</Link>
        </div>
      </>
    );
  }

  const isOwn = team.id === myTeam.id;
  const list = (players ?? []) as Player[];
  const grouped: Record<Position, Player[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of list) grouped[p.position].push(p);

  return (
    <>
      <PageTopBar title={team.name} subtitle={`Kadro · ${list.length} oyuncu`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <BackButton label="Geri" fallback="/league" />
        {isOwn && (
          <div className="mb-4 text-sm">
            <Link href="/team" className="text-emerald hover:underline">→ Kendi kadronu yönet</Link>
          </div>
        )}
        {!isOwn && (
          <div className="mb-4 text-xs text-text-muted">
            Rakip kadro. Oyuncuya tıkla → birkaç özellik görünür; tümünü açmak için profilde <b>500 CR</b>.
          </div>
        )}

        {ORDER.map((pos) => (
          grouped[pos].length > 0 && (
            <div key={pos} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: POSITION_COLORS[pos].color }} />
                <span className="section-label" style={{ color: POSITION_COLORS[pos].color }}>{POSITION_LABELS[pos]} ({grouped[pos].length})</span>
              </div>
              <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
                {grouped[pos].map((p) => (
                  <Link key={p.id} href={`/player/${p.id}`}
                    className="grid grid-cols-[1.7fr_60px_76px] gap-2 px-4 py-2.5 items-center border-b border-border-soft last:border-0 hover:bg-panel-inset/50">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[pos].bg, color: POSITION_COLORS[pos].color }}>{pos}</span>
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.is_youth_academy && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-amber">ALT YAPI</span>}
                    </div>
                    <span className="text-sm text-text-2 num">{p.age}</span>
                    <span className="text-xs text-center text-text-muted border border-border-cm py-1 rounded">İncele</span>
                  </Link>
                ))}
              </div>
            </div>
          )
        ))}
        {list.length === 0 && <div className="text-center py-16 text-text-muted">Bu takımın oyuncusu yok.</div>}
      </div>
    </>
  );
}
