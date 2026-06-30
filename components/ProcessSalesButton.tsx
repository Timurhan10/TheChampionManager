"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Satılık oyuncuları anında işler (normalde günlük cron yapar; en geç 3 günde satılır).
export default function ProcessSalesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/cron/process-sales");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(d.sold > 0 ? `${d.sold} oyuncu satıldı, para kasana eklendi.` : "Şu an satılan olmadı (en geç 3 günde otomatik satılır).");
      router.refresh();
    } catch (e: any) { setMsg(e.message); } finally { setLoading(false); }
  }

  return (
    <div>
      <button onClick={run} disabled={loading}
        className="w-full mt-2 border border-emerald text-emerald text-xs font-semibold py-1.5 rounded-lg hover:bg-emerald/10 disabled:opacity-50">
        {loading ? "İşleniyor…" : "Satışları Şimdi İşle"}
      </button>
      {msg && <p className="text-[11px] text-text-muted mt-1">{msg}</p>}
    </div>
  );
}
