"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PlayerActions({
  playerId, isOwn, forSale, askingPrice, valueCr, isFreeAgent, isYouth = false,
}: {
  playerId: string;
  isOwn: boolean;
  forSale: boolean;
  askingPrice: number | null;
  valueCr: number;
  sellerTeamId: string | null;
  isFreeAgent: boolean;
  isYouth?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [offer, setOffer] = useState<number>(askingPrice ?? valueCr);

  async function call(key: string, url: string, payload: any) {
    setLoading(key); setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
      return data;
    } catch (e: any) { setMsg({ text: e.message, ok: false }); return null; }
    finally { setLoading(null); }
  }

  if (isOwn) {
    if (isYouth) {
      return (
        <div className="bg-panel-inset border border-border-cm rounded-lg p-3 text-center">
          <div className="text-xs font-semibold text-amber mb-1">Alt Yapı Oyuncusu</div>
          <p className="text-[11px] text-text-muted">Alt yapı oyuncuları satışa çıkarılamaz veya transfer edilemez.</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {forSale ? (
          <>
            <div className="text-xs text-amber text-center">Satışta · {askingPrice?.toLocaleString("tr-TR")} CR</div>
            <button onClick={async () => { if (await call("unlist", "/api/players/list-for-sale", { playerId, forSale: false })) setMsg({ text: "Satıştan kaldırıldı.", ok: true }); }}
              disabled={loading === "unlist"}
              className="w-full border border-danger text-danger font-semibold py-2.5 rounded-lg hover:bg-danger/10 text-sm disabled:opacity-50">
              Satıştan Kaldır
            </button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-text-faint text-center">Fiyat oyuncunun performansına göre sistemce belirlenir.</p>
            <button onClick={async () => { const d = await call("list", "/api/players/list-for-sale", { playerId, forSale: true }); if (d) setMsg({ text: `Satışa çıkarıldı · ${(d.price ?? 0).toLocaleString("tr-TR")} CR`, ok: true }); }}
              disabled={loading === "list"}
              className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
              Transfer Pazarına Çıkar
            </button>
          </>
        )}
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-bright" : "text-danger"}`}>{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isFreeAgent ? (
        <button onClick={async () => { if (await call("buy", "/api/transfers/offer", { playerId })) setMsg({ text: "Oyuncu alındı!", ok: true }); }}
          disabled={loading === "buy"}
          className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
          Satın Al ({(askingPrice ?? valueCr).toLocaleString("tr-TR")} CR)
        </button>
      ) : (
        <>
          <input type="number" value={offer} onChange={(e) => setOffer(Number(e.target.value))}
            className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald" placeholder="Teklif (CR)" />
          <button onClick={async () => { const d = await call("offer", "/api/transfers/offer", { playerId, amount: offer }); if (d) setMsg({ text: "Teklif gönderildi.", ok: true }); }}
            disabled={loading === "offer"}
            className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
            Transfer Teklifi Ver
          </button>
        </>
      )}
      <button onClick={async () => { const d = await call("reveal", "/api/players/reveal-all", { playerId }); if (d) setMsg({ text: d.alreadyRevealed ? "Tüm özellikler zaten açık." : "Tüm özellikler açıldı!", ok: true }); }}
        disabled={loading === "reveal"}
        className="w-full border border-blue-cm text-blue-cm-bright font-semibold py-2.5 rounded-lg hover:bg-blue-cm/10 text-sm disabled:opacity-50">
        Tüm Özellikleri Aç · 500 CR
      </button>
      <Link href="/scouting" className="block text-center text-xs text-text-muted hover:text-text-cm pt-1">Scouting Merkezi (paketler) →</Link>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-bright" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
