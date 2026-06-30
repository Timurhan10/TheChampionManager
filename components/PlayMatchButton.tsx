"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Maçı zamanı beklemeden simüle eder; oynanınca sayfa replay'e (MatchCanvas) döner.
export default function PlayMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function play() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/matches/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Maç oynanamadı.");
      router.refresh(); // maç 'finished' oldu → replay görünür
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col items-center">
      <button onClick={play} disabled={loading}
        className="bg-emerald text-emerald-ink font-semibold px-6 py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
        {loading ? "Maç oynanıyor…" : "Maçı Şimdi Oyna"}
      </button>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
