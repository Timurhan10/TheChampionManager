import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import CmpShopClient, { type ShopItem } from "@/components/CmpShopClient";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CmpShopPage() {
  const { gameUser, team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createServiceClient();
  const { data: items } = await supabase
    .from("cmp_shop_items")
    .select("id, name, description, tier, cmp_cost")
    .eq("is_active", true)
    .order("cmp_cost");

  const { data: history } = await supabase
    .from("cmp_purchases")
    .select("id, cmp_spent, created_at, cmp_shop_items(name)")
    .eq("user_id", gameUser?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(10);

  const balance = gameUser?.cmp_points ?? 0;

  return (
    <>
      <PageTopBar title="CMP Mağazası" subtitle="Premium ödüller" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        {/* Bakiye banner'ı */}
        <div className="bg-gradient-to-r from-panel to-panel-inset border border-amber/30 rounded-card p-5 mb-5 flex items-center gap-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
          <div>
            <div className="section-label">CMP Bakiyesi</div>
            <div className="font-display font-extrabold text-3xl text-amber">{formatNumber(balance)}</div>
          </div>
          <div className="ml-auto text-xs text-text-muted max-w-[240px] text-right">
            CMP'yi lig başarılarından kazanırsın (şampiyon +500). Süperstar için ~20 sezon.
          </div>
        </div>

        <CmpShopClient items={(items ?? []) as ShopItem[]} balance={balance} />

        {/* Satın alma geçmişi */}
        <div className="mt-6">
          <div className="section-label mb-2">Satın Alma Geçmişi</div>
          <div className="bg-panel border border-border-cm rounded-card divide-y divide-border-soft">
            {(history ?? []).length === 0 && <div className="px-4 py-6 text-center text-text-muted text-sm">Henüz satın alma yok.</div>}
            {(history ?? []).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{h.cmp_shop_items?.name ?? "—"}</span>
                <span className="flex items-center gap-3">
                  <span className="text-amber font-display font-bold">{formatNumber(h.cmp_spent)} CMP</span>
                  <span className="text-text-faint text-xs">{new Date(h.created_at).toLocaleDateString("tr-TR")}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
