"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeasonEndButton({ leagueId, allFinished }: { leagueId: string; allFinished: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function end() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/seasons/end", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="bg-panel border border-amber/40 rounded-card p-4">
      <div className="text-sm text-text-2 mb-2">
        {allFinished
          ? "Tüm maçlar oynandı. Sezonu kapatınca ödüller (CMP + sezon bonusu CR) dağıtılır, alt yapı genç üretir ve yeni sezon fikstürü oluşturulur."
          : "Sezonu kapatmak için tüm maçların oynanması gerekir."}
      </div>
      {error && <p className="text-sm text-danger mb-2">{error}</p>}
      <button onClick={end} disabled={!allFinished || loading}
        className="bg-emerald text-emerald-ink font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50 text-sm">
        {loading ? "Kapatılıyor..." : "Sezonu Kapat & Yeni Sezon Başlat"}
      </button>
    </div>
  );
}
