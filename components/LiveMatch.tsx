"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LiveMatchCanvas from "./LiveMatchCanvas";
import { teamBadge } from "@/lib/utils";
import type { SimResult } from "@/lib/match-engine/simulator";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
    done: ms === 0,
  };
}

export default function LiveMatch({
  matchId, homeName, awayName, homeColor, awayColor, scheduledAt,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeColor: number;
  awayColor: number;
  scheduledAt: string;
}) {
  const target = new Date(scheduledAt).getTime();
  const [t, setT] = useState(() => diff(target));
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (result) return;
    const i = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(i);
  }, [target, result]);

  async function start() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/matches/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, returnResult: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Maç başlatılamadı.");
      if (!data.result) throw new Error("Maç sonucu alınamadı (zaten oynanmış olabilir). Sayfayı yenileyin.");
      setResult(data.result as SimResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Maç başladı → canlı sahne
  if (result) {
    const stats = result.stats;
    return (
      <div className="flex-1 overflow-y-auto p-[22px]">
        {/* Takım başlığı */}
        <div className="grid grid-cols-3 items-center mb-4">
          <div className="flex items-center gap-2 justify-end">
            <span className="font-display font-bold">{homeName}</span>
            <span className="w-8 h-8 rounded-lg bg-blue-cm/20 text-blue-cm-bright flex items-center justify-center text-xs font-bold">{teamBadge(homeName)}</span>
          </div>
          <div className="text-center text-xs text-text-faint">EV SAHİBİ — DEPLASMAN</div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-danger/20 text-danger flex items-center justify-center text-xs font-bold">{teamBadge(awayName)}</span>
            <span className="font-display font-bold">{awayName}</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-5">
          <LiveMatchCanvas events={result.events} homeColor={homeColor} awayColor={awayColor} />

          <div>
            <div className="section-label mb-2">Maç İstatistikleri</div>
            <div className="bg-panel border border-border-cm rounded-card p-5 space-y-4">
              <StatBar label="Topla Oynama" home={stats.possessionHome} away={100 - stats.possessionHome} suffix="%" />
              <StatBar label="Toplam Şut" home={stats.shotsHome} away={stats.shotsAway} />
              <StatBar label="İsabetli Şut" home={stats.sotHome} away={stats.sotAway} />
              <StatBar label="Korner" home={stats.cornersHome} away={stats.cornersAway} />
            </div>
            <Link href={`/match/${matchId}/result`} className="block text-center mt-4 border border-border-cm text-sm py-2 rounded-lg hover:bg-panel-inset">
              Maç Özeti →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Maç öncesi başlatma ekranı
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="section-label mb-2">Maç Başlamak Üzere</div>
      <div className="font-display font-bold text-2xl mb-1">{homeName} <span className="text-text-faint">vs</span> {awayName}</div>
      <div className="text-text-muted text-sm mb-6">{new Date(scheduledAt).toLocaleString("tr-TR")}</div>

      {!t.done && (
        <div className="flex gap-3 mb-8">
          {[["GÜN", t.d], ["SAAT", t.h], ["DK", t.m], ["SN", t.s]].map(([label, val]) => (
            <div key={label as string} className="bg-panel border border-border-cm rounded-card px-5 py-3 min-w-[72px]">
              <div className="font-display font-extrabold text-3xl">{String(val).padStart(2, "0")}</div>
              <div className="text-[10px] text-text-faint tracking-wide mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={start} disabled={loading}
        className="bg-emerald text-emerald-ink font-semibold px-6 py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
        {loading ? "Maç hazırlanıyor…" : "Maçı Canlı Oyna"}
      </button>
      <p className="text-text-faint text-xs mt-2">Maç 10 dakika sürer (5 dk + 5 dk). Başlatınca canlı izlersin.</p>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}

      <Link href="/tactics" className="mt-6 border border-border-cm text-text-2 font-semibold px-6 py-2.5 rounded-lg hover:bg-panel-inset">
        Taktiği Hazırla
      </Link>
      <p className="text-text-faint text-xs mt-3">Taktiğini maça başlamadan serbestçe değiştirebilirsin.</p>
    </div>
  );
}

function StatBar({ label, home, away, suffix = "" }: { label: string; home: number; away: number; suffix?: string }) {
  const total = home + away || 1;
  const hPct = (home / total) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-display font-bold text-blue-cm-bright">{home}{suffix}</span>
        <span className="text-text-muted text-xs">{label}</span>
        <span className="font-display font-bold text-danger">{away}{suffix}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-panel-inset">
        <div className="bg-blue-cm" style={{ width: `${hPct}%` }} />
        <div className="bg-danger" style={{ width: `${100 - hPct}%` }} />
      </div>
    </div>
  );
}
