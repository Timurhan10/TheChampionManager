"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchDay } from "@/lib/schedule-generator";

const DAYS: { value: MatchDay; label: string }[] = [
  { value: "MON", label: "Pzt" }, { value: "TUE", label: "Sal" },
  { value: "WED", label: "Çar" }, { value: "THU", label: "Per" },
  { value: "FRI", label: "Cum" }, { value: "SAT", label: "Cmt" },
  { value: "SUN", label: "Paz" },
];

export default function LeagueActions() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  // create state
  const [name, setName] = useState("");
  const [day1, setDay1] = useState<MatchDay>("TUE");
  const [day2, setDay2] = useState<MatchDay>("SAT");
  const [time, setTime] = useState("20:45");

  // join state
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createLeague() {
    setError(null); setSuccess(null);
    if (!name.trim()) { setError("Lig adı gerekli."); return; }
    if (day1 === day2) { setError("İki maç günü farklı olmalı."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/leagues/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, matchDay1: day1, matchDay2: day2, matchTime: time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Lig oluşturuldu! Davet kodu: ${data.inviteCode}`);
      router.refresh();
      setTimeout(() => router.push(`/league/${data.leagueId}`), 1200);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  async function joinLeague() {
    setError(null); setSuccess(null);
    if (!code.trim()) { setError("Davet kodu gerekli."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
      router.push(`/league/${data.leagueId}`);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
      <div className="flex gap-1 mb-5 bg-panel-inset rounded-lg p-1">
        {(["create", "join"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
              tab === t ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm"}`}>
            {t === "create" ? "Lig Oluştur" : "Lige Katıl"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <div className="space-y-4">
          <div>
            <label className="section-label block mb-1.5">Lig Adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
              className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald" placeholder="Birinci Lig" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1.5">1. Maç Günü</label>
              <select value={day1} onChange={(e) => setDay1(e.target.value as MatchDay)}
                className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald">
                {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="section-label block mb-1.5">2. Maç Günü</label>
              <select value={day2} onChange={(e) => setDay2(e.target.value as MatchDay)}
                className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald">
                {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="section-label block mb-1.5">Maç Saati</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-emerald-bright">{success}</p>}
          <button onClick={createLeague} disabled={loading}
            className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
            {loading ? "..." : "Lig Oluştur"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="section-label block mb-1.5">Davet Kodu</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8}
              className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald font-display tracking-widest" placeholder="ABCD1234" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button onClick={joinLeague} disabled={loading}
            className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
            {loading ? "..." : "Lige Katıl"}
          </button>
        </div>
      )}
    </div>
  );
}
