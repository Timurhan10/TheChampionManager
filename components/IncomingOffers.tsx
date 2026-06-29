"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/utils";

export interface Offer {
  id: string;
  amount: number;
  playerName: string;
  buyerName: string;
}

export default function IncomingOffers({ offers }: { offers: Offer[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function respond(transferId: string, action: "accept" | "reject") {
    setLoading(transferId + action);
    try {
      const res = await fetch("/api/transfers/respond", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e: any) { alert(e.message); } finally { setLoading(null); }
  }

  if (offers.length === 0) {
    return <div className="text-text-muted text-sm py-4 text-center">Gelen teklif yok.</div>;
  }

  return (
    <div className="space-y-2">
      {offers.map((o) => (
        <div key={o.id} className="bg-panel-inset rounded-lg p-3 border-l-2 border-amber">
          <div className="flex justify-between items-start mb-1">
            <div className="text-sm font-semibold">{o.playerName}</div>
            <div className="font-display font-bold text-amber">{formatNumber(o.amount)} CR</div>
          </div>
          <div className="text-xs text-text-muted mb-2">Gönderen: {o.buyerName}</div>
          <div className="flex gap-2">
            <button onClick={() => respond(o.id, "accept")} disabled={loading === o.id + "accept"}
              className="flex-1 bg-emerald text-emerald-ink text-xs font-semibold py-1.5 rounded hover:bg-emerald-bright disabled:opacity-50">Kabul Et</button>
            <button onClick={() => respond(o.id, "reject")} disabled={loading === o.id + "reject"}
              className="flex-1 border border-danger text-danger text-xs font-semibold py-1.5 rounded hover:bg-danger/10 disabled:opacity-50">Reddet</button>
          </div>
        </div>
      ))}
    </div>
  );
}
