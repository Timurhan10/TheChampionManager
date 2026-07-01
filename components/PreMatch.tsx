"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { d, h, m, s, done: ms === 0 };
}

export default function PreMatch({ scheduledAt, homeName, awayName }: { scheduledAt: string; homeName: string; awayName: string; matchId?: string; canPlay?: boolean }) {
  const target = new Date(scheduledAt).getTime();
  const [t, setT] = useState(() => diff(target));

  useEffect(() => {
    const i = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(i);
  }, [target]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="section-label mb-2">Maç Başlamak Üzere</div>
      <div className="font-display font-bold text-2xl mb-1">{homeName} <span className="text-text-faint">vs</span> {awayName}</div>
      <div className="text-text-muted text-sm mb-6">{new Date(scheduledAt).toLocaleString("tr-TR")}</div>

      {t.done ? (
        <div className="text-emerald font-display font-bold text-lg mb-6">Maç başlıyor — sonuç birazdan hazır olacak.</div>
      ) : (
        <div className="flex gap-3 mb-8">
          {[["GÜN", t.d], ["SAAT", t.h], ["DK", t.m], ["SN", t.s]].map(([label, val]) => (
            <div key={label as string} className="bg-panel border border-border-cm rounded-card px-5 py-3 min-w-[72px]">
              <div className="font-display font-extrabold text-3xl">{String(val).padStart(2, "0")}</div>
              <div className="text-[10px] text-text-faint tracking-wide mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <Link href="/tactics" className="border border-border-cm text-text-2 font-semibold px-6 py-2.5 rounded-lg hover:bg-panel-inset">
        Taktiği Hazırla
      </Link>
      <p className="text-text-faint text-xs mt-3">Taktiğini maça kadar serbestçe değiştirebilirsin.</p>
    </div>
  );
}
