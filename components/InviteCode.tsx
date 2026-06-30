"use client";

import { useState } from "react";

// Davet kodu + kopyala butonu. Lig sayfasının sağ üstünde.
export default function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // pano yoksa sessiz geç
    }
  }

  return (
    <div className="inline-flex items-center gap-2 bg-panel border border-border-cm rounded-lg pl-3 pr-1.5 py-1.5">
      <span className="text-[10px] text-text-faint uppercase tracking-wide">Davet Kodu</span>
      <span className="font-display font-bold tracking-[2px] text-emerald text-sm">{code}</span>
      <button onClick={copy} title="Kopyala"
        className="flex items-center gap-1 bg-emerald text-emerald-ink text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-emerald-bright">
        {copied ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Kopyalandı
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
            Kopyala
          </>
        )}
      </button>
    </div>
  );
}
