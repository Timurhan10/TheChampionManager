"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Ligi güvenli siler (kurucu/admin). Lig adını yazarak onay gerekir.
export default function DeleteLeagueButton({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const typed = window.prompt(
      `"${leagueName}" ligini silmek üzeresin.\n\nBu işlem ligi, ona ait yapay zeka takımlarını, AI oyuncularını ve maçları kalıcı olarak siler. Senin takımın, oyuncuların ve paran KORUNUR.\n\nOnaylamak için lig adını birebir yaz:`
    );
    if (typed == null) return;
    if (typed.trim() !== leagueName) { setError("Lig adı eşleşmedi, silme iptal edildi."); return; }

    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/leagues/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, confirmName: typed.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Silinemedi.");
      router.push("/league");
      router.refresh();
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  return (
    <div>
      <button onClick={remove} disabled={loading}
        className="border border-danger text-danger font-semibold px-4 py-2.5 rounded-lg hover:bg-danger/10 disabled:opacity-50 text-sm">
        {loading ? "Siliniyor…" : "Ligi Sil"}
      </button>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
