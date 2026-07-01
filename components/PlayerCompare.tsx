"use client";

import { useMemo, useState } from "react";
import { CATEGORY_ATTRS, CATEGORY_LABELS, ATTR_LABELS, POSITION_COLORS, ratingColor, keyAttrs, type AttributeCategory } from "@/lib/attributes";
import { formatNumber } from "@/lib/utils";

export interface ComparePlayer {
  id: string;
  name: string;
  position: string;
  age: number;
  value_cr: number;
  overall: number | null;                       // bilinmiyorsa null (scout edilmemiş)
  potential: number | null;
  attrs: Record<string, number | null> | null;  // tam özellikler (kendi oyuncun) ya da null
}

// Kendi oyuncularını (veya pazardaki oyuncuları) yan yana karşılaştırır.
// attrs varsa detaylı özellik kıyaslaması, yoksa yalnızca özet gösterilir.
// leftPlayers/rightPlayers verilirse sol ve sağ seçici farklı havuzlardan seçer
// (ör. sol: pazar oyuncuları, sağ: kendi oyuncuların). Verilmezse ikisi de `players`.
export default function PlayerCompare({
  players, leftPlayers, rightPlayers, title = "Oyuncu Karşılaştırma",
}: {
  players?: ComparePlayer[];
  leftPlayers?: ComparePlayer[];
  rightPlayers?: ComparePlayer[];
  title?: string;
}) {
  const left = leftPlayers ?? players ?? [];
  const right = rightPlayers ?? players ?? [];
  const split = !!(leftPlayers || rightPlayers);

  const [aId, setAId] = useState(left[0]?.id ?? "");
  const [bId, setBId] = useState((split ? right[0]?.id : right[1]?.id ?? right[0]?.id) ?? "");
  const [showAttrs, setShowAttrs] = useState(false);

  const a = left.find((p) => p.id === aId) ?? null;
  const b = right.find((p) => p.id === bId) ?? null;

  const categories: AttributeCategory[] = useMemo(() => {
    const base: AttributeCategory[] = ["technical", "mental", "physical"];
    if (a?.position === "GK" || b?.position === "GK") base.push("goalkeeping");
    return base;
  }, [a?.position, b?.position]);

  const bothAttrs = !!(a?.attrs && b?.attrs);
  const keyA = new Set(a ? keyAttrs(a.position) : []);
  const keyB = new Set(b ? keyAttrs(b.position) : []);

  if (left.length === 0 || right.length === 0) {
    return (
      <div className="bg-panel border border-border-cm rounded-card p-4 text-center text-sm text-text-muted">
        Karşılaştırma için en az iki oyuncu gerekir.
      </div>
    );
  }

  const selector = (val: string, set: (v: string) => void, other: string, pool: ComparePlayer[]) => (
    <select value={val} onChange={(e) => set(e.target.value)}
      className="w-full bg-panel-inset border border-border-cm rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-emerald">
      {pool.map((p) => (
        <option key={p.id} value={p.id} disabled={!split && p.id === other}>
          {p.position} · {p.name}{p.overall != null ? ` (${p.overall})` : ""}
        </option>
      ))}
    </select>
  );

  // İki sayıyı karşılaştırıp renklendir (yüksek olan vurgulu).
  const cmpCell = (va: number | null, vb: number | null, side: "a" | "b", colorByRating = false) => {
    const known = va != null && vb != null;
    const mine = side === "a" ? va : vb;
    const win = known && ((side === "a" && (va as number) > (vb as number)) || (side === "b" && (vb as number) > (va as number)));
    const color = mine == null ? "#475A73" : colorByRating ? ratingColor(mine) : win ? "#10B981" : "#94A3B8";
    return <span className="font-semibold tabular-nums" style={{ color }}>{mine ?? "?"}</span>;
  };

  return (
    <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-cm flex items-center justify-between">
        <span className="section-label">{title}</span>
        {bothAttrs && a && b && (
          <button onClick={() => setShowAttrs((s) => !s)}
            className="text-xs font-semibold px-2.5 py-1 rounded border border-border-cm text-text-2 hover:bg-panel-inset hover:text-emerald">
            {showAttrs ? "Özellikleri Gizle" : "Özellikleri Göster"}
          </button>
        )}
      </div>

      {/* Seçiciler + başlık */}
      <div className="grid grid-cols-[1fr_70px_1fr] gap-2 items-center px-4 py-3 border-b border-border-soft">
        {selector(aId, setAId, bId, left)}
        <span className="text-center text-[11px] text-text-faint font-bold">VS</span>
        {selector(bId, setBId, aId, right)}
      </div>

      {a && b && (
        <div className="px-4 py-2">
          {/* Özet satırları */}
          <Row label="Genel Rating" a={cmpCell(a.overall, b.overall, "a", true)} b={cmpCell(a.overall, b.overall, "b", true)} />
          <Row label="Yaş"
            a={<span className="font-semibold text-text-2 tabular-nums">{a.age}</span>}
            b={<span className="font-semibold text-text-2 tabular-nums">{b.age}</span>} />
          <Row label="Değer"
            a={<span className="font-semibold text-text-2 tabular-nums">{formatNumber(a.value_cr)} CR</span>}
            b={<span className="font-semibold text-text-2 tabular-nums">{formatNumber(b.value_cr)} CR</span>} />
          <Row label="Potansiyel"
            a={<Stars potential={a.potential} align="start" />}
            b={<Stars potential={b.potential} align="end" />} />

          {/* Detaylı özellikler — yalnızca her ikisi biliniyorsa ve buton açıksa */}
          {bothAttrs ? (
            showAttrs ? (
              categories.map((cat) => (
                <div key={cat} className="mt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-emerald/80 py-1.5 border-b border-border-soft">{CATEGORY_LABELS[cat]}</div>
                  {CATEGORY_ATTRS[cat].map((key) => {
                    const isKey = keyA.has(key) || keyB.has(key);
                    return (
                      <Row key={key}
                        label={<span className={isKey ? "text-emerald font-semibold" : undefined}>{ATTR_LABELS[key]}{isKey ? " ★" : ""}</span>}
                        a={cmpCell((a.attrs as any)[key] ?? null, (b.attrs as any)[key] ?? null, "a")}
                        b={cmpCell((a.attrs as any)[key] ?? null, (b.attrs as any)[key] ?? null, "b")} />
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="text-[11px] text-text-faint text-center py-3">
                Detaylı özellikler için üstteki <b>“Özellikleri Göster”</b> butonuna bas.
              </p>
            )
          ) : (
            <p className="text-[11px] text-text-faint text-center py-3">
              Detaylı özellik kıyaslaması yalnızca kendi oyuncuların (veya scout edilmiş oyuncular) için gösterilir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, a, b }: { label: React.ReactNode; a: React.ReactNode; b: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_70px_1fr] items-center py-1 text-sm">
      <div className="text-left">{a}</div>
      <div className="text-center text-[11px] text-text-faint">{label}</div>
      <div className="text-right">{b}</div>
    </div>
  );
}

function Stars({ potential, align = "end" }: { potential: number | null; align?: "start" | "end" }) {
  const filled = potential != null ? Math.max(0, Math.min(5, Math.round(potential / 4))) : 0;
  return (
    <div className={`flex gap-0.5 ${align === "start" ? "justify-start" : "justify-end"}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i < filled ? "#F59E0B" : "none"} stroke={i < filled ? "#F59E0B" : "#475A73"} strokeWidth="2.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}
