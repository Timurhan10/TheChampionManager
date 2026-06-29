"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/utils";

export interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  cmp_cost: number;
}

const TIER_COLOR: Record<string, string> = { bronze: "#94A3B8", silver: "#60A5FA", gold: "#F59E0B" };

export default function CmpShopClient({ items, balance }: { items: ShopItem[]; balance: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<ShopItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  async function purchase(item: ShopItem) {
    setLoading(true);
    try {
      const res = await fetch("/api/cmp-shop/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ text: data.result ?? "Satın alındı!", ok: true });
      setConfirm(null);
      router.refresh();
    } catch (e: any) { setToast({ text: e.message, ok: false }); }
    finally { setLoading(false); }
  }

  const tiers = ["bronze", "silver", "gold"] as const;
  const TIER_LABEL: Record<string, string> = { bronze: "BRONZ", silver: "GÜMÜŞ", gold: "ALTIN" };

  return (
    <>
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${toast.ok ? "bg-emerald/15 text-emerald-bright border border-emerald/40" : "bg-danger/15 text-danger border border-danger/40"}`}>
          {toast.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {tiers.map((tier) => {
          const color = TIER_COLOR[tier];
          const tierItems = items.filter((i) => i.tier === tier);
          return (
            <div key={tier}>
              <div className="text-center mb-3">
                <span className="font-display font-extrabold text-lg tracking-wide" style={{ color, textShadow: tier === "gold" ? `0 0 16px ${color}66` : undefined }}>
                  {TIER_LABEL[tier]}
                </span>
              </div>
              <div className="space-y-3">
                {tierItems.map((item) => {
                  const locked = balance < item.cmp_cost;
                  return (
                    <div key={item.id} className={`bg-panel border rounded-card p-4 ${locked ? "opacity-50 border-border-cm" : "border-border-cm"}`}
                      style={!locked && tier === "gold" ? { borderColor: `${color}66`, boxShadow: `0 0 18px ${color}22` } : undefined}>
                      <div className="font-semibold text-sm mb-1">{item.name}</div>
                      <div className="text-xs text-text-muted mb-3 min-h-[32px]">{item.description}</div>
                      <div className="flex items-center justify-between">
                        <span className="font-display font-extrabold" style={{ color }}>{formatNumber(item.cmp_cost)} CMP</span>
                        {locked ? (
                          <span className="text-[11px] text-danger">{formatNumber(item.cmp_cost - balance)} CMP eksik</span>
                        ) : (
                          <button onClick={() => setConfirm(item)}
                            className="bg-emerald text-emerald-ink text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-bright">Satın Al</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Onay modalı */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !loading && setConfirm(null)}>
          <div className="bg-panel border border-border-cm rounded-card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg mb-1">{confirm.name}</h3>
            <p className="text-sm text-text-muted mb-1">{confirm.description}</p>
            <p className="text-sm mb-4"><span className="text-amber font-display font-bold">{formatNumber(confirm.cmp_cost)} CMP</span> harcanacak.</p>
            <p className="text-xs text-danger mb-5">Bu işlem geri alınamaz. Devam edilsin mi?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} disabled={loading}
                className="flex-1 border border-border-cm py-2.5 rounded-lg text-sm hover:bg-panel-inset disabled:opacity-50">Vazgeç</button>
              <button onClick={() => purchase(confirm)} disabled={loading}
                className="flex-1 bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
                {loading ? "..." : "Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
