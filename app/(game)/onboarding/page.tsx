"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generatePlayerName, SQUAD_REQUIREMENTS, ONBOARDING_SQUAD_SIZE } from "@/lib/player-generator";
import { POSITION_COLORS, POSITION_LABELS } from "@/lib/attributes";
import type { Position } from "@/types/game";
import { cn } from "@/lib/utils";

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];

interface DraftPlayer {
  name: string;
  position: Position;
}

// Varsayılan 25 kişilik kadro dağılımı (2 GK, 8 DF, 9 MF, 6 FW)
function defaultSquad(): DraftPlayer[] {
  const dist: Position[] = [
    ...Array(2).fill("GK"),
    ...Array(8).fill("DF"),
    ...Array(9).fill("MF"),
    ...Array(6).fill("FW"),
  ];
  return dist.map((position) => ({ name: generatePlayerName(), position }));
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [teamName, setTeamName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10B981");
  const [secondaryColor, setSecondaryColor] = useState("#1A2A3E");
  const [players, setPlayers] = useState<DraftPlayer[]>(defaultSquad);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function counts() {
    return POSITIONS.reduce(
      (acc, p) => ({ ...acc, [p]: players.filter((x) => x.position === p).length }),
      {} as Record<Position, number>
    );
  }

  function squadValid(): string | null {
    if (players.length !== ONBOARDING_SQUAD_SIZE) return `Tam ${ONBOARDING_SQUAD_SIZE} oyuncu gerekli.`;
    for (const [pos, req] of Object.entries(SQUAD_REQUIREMENTS)) {
      if (players.filter((p) => p.position === pos).length < req.min) {
        return `En az ${req.min} ${req.label} gerekli.`;
      }
    }
    if (players.some((p) => !p.name.trim())) return "Tüm oyuncuların ismi olmalı.";
    return null;
  }

  function updatePlayer(i: number, patch: Partial<DraftPlayer>) {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function submit() {
    setError(null);
    const sErr = squadValid();
    if (sErr) { setError(sErr); return; }
    if (!username.trim() || !teamName.trim()) { setError("Kullanıcı adı ve takım adı zorunlu."); setStep(1); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, teamName, primaryColor, secondaryColor, players }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata oluştu.");
      router.replace("/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const c = counts();

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        {/* Adım göstergesi */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm",
                  step >= s ? "bg-emerald text-emerald-ink" : "bg-panel-inset text-text-faint"
                )}
              >
                {s}
              </div>
              {s < 3 && <div className={cn("flex-1 h-0.5", step > s ? "bg-emerald" : "bg-panel-inset")} />}
            </div>
          ))}
        </div>

        {/* ADIM 1: Takım */}
        {step === 1 && (
          <div className="bg-panel border border-border-cm rounded-card p-7 shadow-card">
            <h2 className="font-display font-bold text-2xl mb-1">Takımını Kur</h2>
            <p className="text-text-muted text-sm mb-6">Menajerlik kariyerine başla.</p>

            <div className="space-y-5">
              <div>
                <label className="section-label block mb-1.5">Kullanıcı Adı</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={50}
                  className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald" placeholder="Menajer_Murat" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Takım Adı</label>
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={100}
                  className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald" placeholder="Anadolu FK" />
              </div>
              <div className="flex gap-6">
                <div>
                  <label className="section-label block mb-1.5">Birincil Renk</label>
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-16 h-10 rounded-lg bg-panel-inset border border-border-cm cursor-pointer" />
                </div>
                <div>
                  <label className="section-label block mb-1.5">İkincil Renk</label>
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-16 h-10 rounded-lg bg-panel-inset border border-border-cm cursor-pointer" />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-danger mt-4">{error}</p>}
            <div className="flex justify-end mt-7">
              <button
                onClick={() => { if (!username.trim() || !teamName.trim()) { setError("Kullanıcı adı ve takım adı zorunlu."); return; } setError(null); setStep(2); }}
                className="bg-emerald text-emerald-ink font-semibold px-6 py-2.5 rounded-lg hover:bg-emerald-bright transition-colors">
                Devam →
              </button>
            </div>
          </div>
        )}

        {/* ADIM 2: Oyuncular */}
        {step === 2 && (
          <div className="bg-panel border border-border-cm rounded-card p-7 shadow-card">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-bold text-2xl">Kadronu Oluştur</h2>
              <button onClick={() => setPlayers(defaultSquad())} className="text-xs text-blue-cm-bright hover:underline">
                Tümünü Yeniden Üret
              </button>
            </div>
            <p className="text-text-muted text-sm mb-4">25 oyuncu — en az 1 GK, 4 DF, 4 MF, 3 FW.</p>

            {/* Pozisyon sayaçları */}
            <div className="flex gap-2 mb-5">
              {POSITIONS.map((p) => {
                const req = SQUAD_REQUIREMENTS[p].min;
                const ok = c[p] >= req;
                return (
                  <div key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: POSITION_COLORS[p].bg, color: ok ? POSITION_COLORS[p].color : "#EF4444" }}>
                    {p} {c[p]}/{req}+
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-panel-inset rounded-lg px-3 py-2">
                  <span className="text-text-faint text-xs w-6 num">{i + 1}</span>
                  <input value={p.name} onChange={(e) => updatePlayer(i, { name: e.target.value })}
                    className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-emerald" />
                  <button onClick={() => updatePlayer(i, { name: generatePlayerName() })}
                    title="Rastgele isim" className="text-text-faint hover:text-emerald text-xs px-1.5">⟳</button>
                  <div className="flex gap-1">
                    {POSITIONS.map((pos) => (
                      <button key={pos} onClick={() => updatePlayer(i, { position: pos })}
                        className={cn("w-9 py-1 rounded text-[11px] font-bold transition-colors")}
                        style={p.position === pos
                          ? { background: POSITION_COLORS[pos].color, color: "#06231A" }
                          : { background: "transparent", color: "#64748B" }}>
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-danger mt-4">{error}</p>}
            <div className="flex justify-between mt-7">
              <button onClick={() => setStep(1)} className="text-text-muted hover:text-text-cm px-4 py-2.5">← Geri</button>
              <button onClick={() => { const e = squadValid(); if (e) { setError(e); return; } setError(null); setStep(3); }}
                className="bg-emerald text-emerald-ink font-semibold px-6 py-2.5 rounded-lg hover:bg-emerald-bright transition-colors">
                Devam →
              </button>
            </div>
          </div>
        )}

        {/* ADIM 3: Özet */}
        {step === 3 && (
          <div className="bg-panel border border-border-cm rounded-card p-7 shadow-card">
            <h2 className="font-display font-bold text-2xl mb-1">Özet & Onay</h2>
            <p className="text-text-muted text-sm mb-6">Her şey hazır görünüyor.</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-panel-inset rounded-lg p-4">
                <div className="section-label mb-1">Takım</div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded" style={{ background: primaryColor }} />
                  <span className="font-display font-bold text-lg">{teamName}</span>
                </div>
                <div className="text-xs text-text-muted mt-1">Menajer: {username}</div>
              </div>
              <div className="bg-panel-inset rounded-lg p-4">
                <div className="section-label mb-1">Başlangıç Bütçesi</div>
                <div className="font-display font-extrabold text-2xl text-emerald">100.000 CR</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
              {POSITIONS.map((p) => (
                <div key={p} className="bg-panel-inset rounded-lg p-3 text-center">
                  <div className="font-display font-bold text-xl" style={{ color: POSITION_COLORS[p].color }}>{c[p]}</div>
                  <div className="text-xs text-text-muted">{POSITION_LABELS[p]}</div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-danger mb-4">{error}</p>}
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="text-text-muted hover:text-text-cm px-4 py-2.5">← Geri</button>
              <button onClick={submit} disabled={submitting}
                className="bg-emerald text-emerald-ink font-semibold px-8 py-2.5 rounded-lg hover:bg-emerald-bright transition-colors disabled:opacity-50">
                {submitting ? "Oluşturuluyor..." : "Takımı Kur 🏆"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
