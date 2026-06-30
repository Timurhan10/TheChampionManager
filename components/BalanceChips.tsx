"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/utils";
import { useGameContext } from "./GameContextProvider";

// CR/CMP göstergeleri. Sunucudan gelen başlangıç değeri varsa anında gösterir;
// her mount'ta /api/me ile taze veriyi çekip günceller. Değer bilinmiyorsa skeleton.
export default function BalanceChips() {
  const ctx = useGameContext();
  const [cr, setCr] = useState<number | null>(ctx.cr > 0 ? ctx.cr : null);
  const [cmp, setCmp] = useState<number | null>(ctx.cmp > 0 ? ctx.cmp : null);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (typeof d.credits === "number") setCr(d.credits);
        if (typeof d.cmp === "number") setCmp(d.cmp);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <>
      {/* CR */}
      <div className="flex items-center gap-2 bg-panel-inset border border-border-cm rounded-lg px-3 py-1.5">
        <span className="w-4 h-4 rounded-full bg-[radial-gradient(circle_at_30%_30%,#34D399,#10B981)]" />
        {cr === null ? <Skeleton w={44} /> : <span className="font-display font-bold text-[14px]">{formatNumber(cr)}</span>}
        <span className="text-[11px] text-text-muted">CR</span>
      </div>
      {/* CMP */}
      <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border border-amber/40 bg-amber/[0.08]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
        {cmp === null ? <Skeleton w={32} /> : <span className="font-display font-bold text-[14px] text-amber">{formatNumber(cmp)}</span>}
      </div>
    </>
  );
}

function Skeleton({ w }: { w: number }) {
  return <span className="inline-block h-[14px] rounded bg-border-cm/60 animate-pulse" style={{ width: w }} />;
}
