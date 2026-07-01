import { redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext } from "@/lib/data";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import NotificationsPanel, { type NotificationItem } from "@/components/NotificationsPanel";
import { formatNumber, teamBadge } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { gameUser, team } = await getGameContext();

  // Takımı yoksa onboarding'e yönlendir
  if (!team) redirect("/onboarding");

  const supabase = createClient();
  const svc = createServiceClient();
  const [{ count: playerCount }, { data: notifications }, { data: nextMatch }] = await Promise.all([
    supabase.from("players").select("id", { count: "exact", head: true }).eq("team_id", team.id),
    supabase.from("notifications").select("id, type, title, body, is_read, created_at").order("created_at", { ascending: false }).limit(12),
    svc.from("matches")
      .select("id, scheduled_at, week, home_team_id, away_team_id")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .eq("status", "scheduled")
      .not("league_id", "is", null)
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // Sıradaki maçın rakibi
  let opponentName: string | null = null;
  let isHome = true;
  if (nextMatch) {
    isHome = nextMatch.home_team_id === team.id;
    const oppId = isHome ? nextMatch.away_team_id : nextMatch.home_team_id;
    const { data: opp } = await svc.from("teams").select("name").eq("id", oppId).maybeSingle();
    opponentName = opp?.name ?? "Rakip";
  }

  return (
    <>
      <PageTopBar title={team.name} subtitle="Menajerlik Paneli" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sonraki Maç */}
          <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
            <div className="section-label mb-3">Sonraki Maç</div>
            {nextMatch && opponentName ? (
              <div className="flex flex-col items-center justify-center py-5 text-center">
                <span className="w-11 h-11 rounded-lg bg-panel-inset flex items-center justify-center text-sm font-bold mb-2">
                  {teamBadge(opponentName)}
                </span>
                <p className="font-display font-bold text-lg mb-0.5">
                  {isHome ? "vs" : "@"} {opponentName}
                </p>
                <p className="text-text-faint text-xs mb-1">
                  Hafta {nextMatch.week ?? "-"} · {isHome ? "Ev sahibi" : "Deplasman"}
                </p>
                <p className="text-text-muted text-xs mb-4">
                  {new Date(nextMatch.scheduled_at).toLocaleString("tr-TR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
                <Link href={`/match/${nextMatch.id}`} className="bg-emerald text-emerald-ink text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-bright">
                  Maça Git →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-panel-inset flex items-center justify-center mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                </div>
                <p className="text-text-2 text-sm mb-1">Planlanmış maç yok</p>
                <p className="text-text-faint text-xs mb-4">Oynamaya başlamak için bir lige katıl.</p>
                <Link href="/league" className="bg-emerald text-emerald-ink text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-bright">
                  Lige Katıl
                </Link>
              </div>
            )}
          </div>

          {/* Bütçe özeti */}
          <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
            <div className="section-label mb-3">Kasa</div>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-text-muted mb-1">Kredi (CR)</div>
                <div className="font-display font-extrabold text-3xl text-emerald">{formatNumber(gameUser?.credits ?? 0)} <span className="text-base">CR</span></div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-1">CM Puanı (CMP)</div>
                <div className="font-display font-extrabold text-3xl text-amber">{formatNumber(gameUser?.cmp_points ?? 0)} <span className="text-base">CMP</span></div>
              </div>
            </div>
          </div>

          {/* Takım özeti */}
          <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
            <div className="section-label mb-3">Takım</div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-muted">Kadro</span>
                <span className="font-display font-bold text-lg">{playerCount ?? 0} oyuncu</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-muted">Renkler</span>
                <div className="flex gap-1.5">
                  <span className="w-5 h-5 rounded" style={{ background: team.primary_color }} />
                  <span className="w-5 h-5 rounded" style={{ background: team.secondary_color }} />
                </div>
              </div>
              <Link href="/team" className="block text-center mt-2 border border-border-cm text-sm py-2 rounded-lg hover:bg-panel-inset">
                Kadroyu Yönet →
              </Link>
            </div>
          </div>
        </div>

        {/* Hızlı erişim */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[
            { href: "/tactics", label: "Taktik Kur", desc: "Diziliş & ayarlar" },
            { href: "/transfer-market", label: "Transfer Pazarı", desc: "Oyuncu al/sat" },
            { href: "/scouting", label: "Scouting", desc: "Yetenek keşfet" },
            { href: "/cmp-shop", label: "CMP Mağazası", desc: "Premium ödüller" },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="bg-panel border border-border-cm rounded-card p-4 hover:border-emerald transition-colors">
              <div className="font-display font-bold text-sm mb-0.5">{q.label}</div>
              <div className="text-xs text-text-muted">{q.desc}</div>
            </Link>
          ))}
        </div>

        {/* Bildirimler */}
        <div className="mt-4">
          <NotificationsPanel items={(notifications ?? []) as NotificationItem[]} />
        </div>
      </div>
    </>
  );
}
