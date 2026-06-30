"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Serbest oyuncu havuzunu doldurur (idempotent). Pazar boşsa kullanışlı.
export default function MarketSeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function seed() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/transfer-market/seed", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(d.added > 0 ? `${d.added} serbest oyuncu eklendi.` : "Havuz zaten dolu.");
      router.refresh();
    } catch (e: any) { setMsg(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={seed} disabled={loading}
        className="border border-blue-cm text-blue-cm-bright text-sm px-3 py-2 rounded-lg hover:bg-blue-cm/10 disabled:opacity-50">
        {loading ? "Dolduruluyor…" : "Serbest Oyuncuları Yenile"}
      </button>
      {msg && <span className="text-xs text-text-muted">{msg}</span>}
    </div>
  );
}
