"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartLeagueButton({ leagueId, teamCount, size }: { leagueId: string; teamCount: number; size: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/leagues/start", {
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
      <div className="text-sm text-text-2 mb-3">
        Lig <span className="text-amber font-semibold">bekliyor</span>. Şu an {teamCount}/{size} takım var.
        Başlatınca kalan {size - teamCount} slot yapay zeka takımlarıyla doldurulur ve fikstür oluşturulur.
      </div>
      {error && <p className="text-sm text-danger mb-2">{error}</p>}
      <button onClick={start} disabled={loading}
        className="bg-emerald text-emerald-ink font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
        {loading ? "Başlatılıyor..." : "Ligi Başlat"}
      </button>
    </div>
  );
}
