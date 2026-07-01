"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCOUT_PACKAGES, SCOUT_UPGRADE_CMP, type ScoutLevelPkg } from "@/lib/scouting";
import { COUNTRIES } from "@/lib/countries";
import { POSITION_COLORS } from "@/lib/attributes";
import { formatNumber, cn } from "@/lib/utils";

const DUR_LABEL: Record<ScoutLevelPkg, string> = { basic: "Anlık", detailed: "12 saat", full: "48 saat" };

// Ülkeye direktör gönder → süreye göre 1-3 oyuncu keşfet.
export function CountryScout() {
  const router = useRouter();
  const [country, setCountry] = useState(COUNTRIES[0].key);
  const [level, setLevel] = useState<ScoutLevelPkg>("detailed");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function send() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/scouting/country", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, level }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg({ text: d.instant ? `${d.count} oyuncu bulundu!` : `Direktör ${d.country}'ya gönderildi (${DUR_LABEL[level]}).`, ok: true });
      router.refresh();
    } catch (e: any) { setMsg({ text: e.message, ok: false }); } finally { setLoading(false); }
  }

  return (
    <div className="bg-panel border border-border-cm rounded-card p-5">
      <div className="section-label mb-1">Ülkeye Direktör Gönder</div>
      <p className="text-xs text-text-muted mb-3">Bir ülke seç, süreye göre 1-3 yeni oyuncu keşfet. Uzun süre = daha kaliteli oyuncu + daha çok bilgi.</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {COUNTRIES.map((c) => (
          <button key={c.key} onClick={() => setCountry(c.key)}
            className={cn("px-2.5 py-1.5 rounded-lg text-sm border", country === c.key ? "border-emerald bg-emerald/10 text-emerald" : "border-border-cm bg-panel-inset text-text-muted")}>
            <span className="mr-1">{c.flag}</span>{c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {(Object.keys(SCOUT_PACKAGES) as ScoutLevelPkg[]).map((key) => {
          const p = SCOUT_PACKAGES[key];
          return (
            <button key={key} onClick={() => setLevel(key)}
              className={cn("p-2.5 rounded-lg border text-left", level === key ? "border-emerald bg-emerald/10" : "border-border-cm bg-panel-inset")}>
              <div className="font-semibold text-sm">{DUR_LABEL[key]}</div>
              <div className="text-[10px] text-text-muted">{key === "basic" ? "az bilgi" : key === "detailed" ? "orta bilgi" : "tam bilgi"}</div>
              <div className="text-xs font-display font-bold text-emerald mt-1">{formatNumber(p.cost)} CR</div>
            </button>
          );
        })}
      </div>

      <button onClick={send} disabled={loading}
        className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
        {loading ? "Gönderiliyor…" : "Direktör Gönder"}
      </button>
      {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-emerald-bright" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

interface SearchPlayer { id: string; name: string; age: number; position: string; team_id: string | null; }

export function ScoutLevelPanel({ level }: { level: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = Math.round((level / 3) * 100);

  async function upgrade() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/scouting/upgrade", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="bg-panel border border-border-cm rounded-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="section-label">Scout Seviyesi</div>
          <div className="font-display font-bold text-lg">Seviye {level} / 3</div>
        </div>
        {level < 3 && (
          <button onClick={upgrade} disabled={loading}
            className="bg-amber/15 border border-amber text-amber font-semibold px-4 py-2 rounded-lg hover:bg-amber/25 text-sm disabled:opacity-50">
            {loading ? "..." : `Seviye Yükselt · ${formatNumber(SCOUT_UPGRADE_CMP)} CMP`}
          </button>
        )}
      </div>
      <div className="h-2 rounded-full bg-panel-inset overflow-hidden mb-2">
        <div className="h-full bg-amber rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-text-muted">Seviye arttıkça scout başına açılan özellik sayısı artar.</p>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}

export function ScoutSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchPlayer[]>([]);
  const [selected, setSelected] = useState<SearchPlayer | null>(null);
  const [pkg, setPkg] = useState<ScoutLevelPkg>("detailed");
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function search() {
    setSearching(true);
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.players ?? []);
    } finally { setSearching(false); }
  }

  async function start() {
    if (!selected) return;
    setStarting(true); setMsg(null);
    try {
      const res = await fetch("/api/scouting/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayerId: selected.id, level: pkg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ text: data.instant ? "Scout tamamlandı!" : "Scout görevi başladı.", ok: true });
      setSelected(null);
      router.refresh();
    } catch (e: any) { setMsg({ text: e.message, ok: false }); } finally { setStarting(false); }
  }

  return (
    <div className="bg-panel border border-border-cm rounded-card p-5">
      <div className="section-label mb-3">Yeni Scout Başlat</div>

      <div className="flex gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Oyuncu ara..." className="flex-1 bg-panel-inset border border-border-cm rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald" />
        <button onClick={search} disabled={searching} className="bg-panel-inset border border-border-cm px-4 rounded-lg text-sm hover:border-emerald disabled:opacity-50">Ara</button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1 max-h-[160px] overflow-y-auto mb-3">
          {results.map((p) => (
            <button key={p.id} onClick={() => setSelected(p)}
              className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm border", selected?.id === p.id ? "border-emerald bg-emerald/10" : "border-transparent bg-panel-inset hover:border-border-cm")}>
              <span className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[p.position]?.bg, color: POSITION_COLORS[p.position]?.color }}>{p.position}</span>
              <span className="truncate">{p.name}</span>
              <span className="text-xs text-text-faint ml-auto">{p.age} yaş{p.team_id == null ? " · Serbest" : ""}</span>
            </button>
          ))}
        </div>
      )}

      {/* Paketler */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {(Object.keys(SCOUT_PACKAGES) as ScoutLevelPkg[]).map((key) => {
          const p = SCOUT_PACKAGES[key];
          return (
            <button key={key} onClick={() => setPkg(key)}
              className={cn("p-2.5 rounded-lg border text-left", pkg === key ? "border-emerald bg-emerald/10" : "border-border-cm bg-panel-inset")}>
              <div className="font-semibold text-sm">{p.label}</div>
              <div className="text-[10px] text-text-muted">{p.desc}</div>
              <div className="text-xs font-display font-bold text-emerald mt-1">{formatNumber(p.cost)} CR</div>
            </button>
          );
        })}
      </div>

      <button onClick={start} disabled={!selected || starting}
        className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
        {selected ? `Scout Başlat: ${selected.name}` : "Önce oyuncu seç"}
      </button>
      {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-emerald-bright" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
