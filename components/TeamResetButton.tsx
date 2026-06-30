"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Lig başlamadan + transfer yapılmadan takımı sıfırlar. Para korunur.
export default function TeamResetButton({ editable, reason }: { editable: boolean; reason?: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/teams/reset", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.replace("/onboarding");
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  if (!editable) {
    return (
      <span className="text-xs text-text-faint" title={reason}>
        Takım sıfırlama kapalı {reason ? `(${reason})` : ""}
      </span>
    );
  }

  return (
    <>
      <button onClick={() => setConfirm(true)}
        className="border border-danger text-danger text-sm px-3 py-2 rounded-lg hover:bg-danger/10">
        Takımı Sil & Yeniden Kur
      </button>
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !loading && setConfirm(false)}>
          <div className="bg-panel border border-border-cm rounded-card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg mb-1">Takımı sıfırla?</h3>
            <p className="text-sm text-text-muted mb-1">Tüm oyuncuların ve takımın silinir, baştan kuracaksın.</p>
            <p className="text-xs text-text-2 mb-4">Paran (CR/CMP) <b>olduğu gibi kalır</b> — geri ödeme yok.</p>
            {error && <p className="text-sm text-danger mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} disabled={loading} className="flex-1 border border-border-cm py-2.5 rounded-lg text-sm hover:bg-panel-inset disabled:opacity-50">Vazgeç</button>
              <button onClick={reset} disabled={loading} className="flex-1 bg-danger text-white font-semibold py-2.5 rounded-lg hover:opacity-90 text-sm disabled:opacity-50">
                {loading ? "Siliniyor…" : "Sil & Yeniden Kur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
