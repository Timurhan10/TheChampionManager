import { redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import { AcademyToggle, IntakeButton } from "@/components/YouthAcademyClient";
import { POSITION_COLORS } from "@/lib/attributes";
import { formatNumber } from "@/lib/utils";
import type { Player } from "@/types/game";

export default async function YouthAcademyPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createClient();
  const { data: academy } = await supabase.from("youth_academy").select("*").eq("team_id", team.id).maybeSingle();
  const { data: youthPlayers } = await supabase
    .from("players").select("*").eq("team_id", team.id).eq("is_youth_academy", true).order("created_at", { ascending: false });

  const active = academy?.is_active ?? false;
  const youth = (youthPlayers ?? []) as Player[];

  return (
    <>
      <PageTopBar title="Alt Yapı" subtitle="Akademi yönetimi" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        {/* Durum çubuğu */}
        <div className="bg-panel border border-border-cm rounded-card p-5 mb-5 flex items-center gap-5">
          <div className="flex-1">
            <div className="section-label mb-1">Akademi Durumu</div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-pill ${active ? "bg-emerald/15 text-emerald" : "bg-panel-inset text-text-muted"}`}>
                {active ? "AKTİF" : "PASİF"}
              </span>
              <span className="text-sm text-text-muted">Haftalık Maliyet: {formatNumber(academy?.weekly_cost ?? 1000)} CR</span>
            </div>
          </div>
          <AcademyToggle active={active} />
        </div>

        <div className="grid grid-cols-[1fr_340px] gap-5">
          {/* Sol: bilgi + üretim */}
          <div className="space-y-5">
            <div className="bg-panel border border-border-cm rounded-card p-5">
              <div className="section-label mb-2">Nasıl Çalışır?</div>
              <p className="text-sm text-text-2 leading-relaxed">
                Aktif alt yapı her hafta {formatNumber(academy?.weekly_cost ?? 1000)} CR'ye mal olur ve sezon sonunda
                1-3 genç oyuncu (16-19 yaş, yüksek potansiyel) üretir. Üretilen oyuncuların özellikleri gizli başlar —
                scouting ile açabilirsin.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Mevcut Genç" value={`${youth.length}`} />
              <Stat label="Bu Sezon Beklenen" value="1-3" />
              <Stat label="Durum" value={active ? "Aktif" : "Pasif"} />
            </div>

            {active && (
              <div className="bg-panel border border-border-cm rounded-card p-5">
                <div className="section-label mb-3">Sezon Sonu İşlemi</div>
                <IntakeButton active={active} />
              </div>
            )}
          </div>

          {/* Sağ: genç oyuncular */}
          <div>
            <div className="section-label mb-2">Akademi Oyuncuları ({youth.length})</div>
            <div className="space-y-2">
              {youth.length === 0 && <div className="bg-panel border border-border-cm rounded-card p-6 text-center text-text-muted text-sm">Henüz alt yapı oyuncusu yok.</div>}
              {youth.map((p) => (
                <Link key={p.id} href={`/player/${p.id}`} className="block bg-panel border border-border-cm rounded-card p-3 hover:border-emerald">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[p.position].bg, color: POSITION_COLORS[p.position].color }}>{p.position}</span>
                      {p.name}
                    </span>
                    <span className="text-xs text-text-muted">{p.age} yaş</span>
                  </div>
                  <div className="text-xs text-text-faint mt-1.5">Özellikler gizli — scout et</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel border border-border-cm rounded-card p-4 text-center">
      <div className="font-display font-extrabold text-2xl text-emerald">{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
