"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/utils";

interface Standing {
  teamId: string; name: string; isAi: boolean;
  points: number; wins: number; draws: number; losses: number; gf: number; ga: number;
}
interface AdminLeague {
  id: string; name: string; status: string; season: number; inviteCode: string | null;
  createdAt: string; creator: string;
  teamCount: number; humanCount: number; aiCount: number;
  matchTotal: number; matchDone: number; standings: Standing[];
}
interface Totals {
  users: number; teams: number; humanTeams: number; aiTeams: number;
  players: number; transfers: number; leagues: number; activeLeagues: number;
}

const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  waiting: { t: "Bekliyor", c: "#F59E0B" },
  active: { t: "Aktif", c: "#10B981" },
  finished: { t: "Bitti", c: "#94A3B8" },
};

export default function AdminLeagues() {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/admin/leagues");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setLeagues(d.leagues ?? []);
      setTotals(d.totals ?? null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(l: AdminLeague) {
    const typed = window.prompt(
      `"${l.name}" ligini SİLMEK üzeresin.\n\nBu işlem ligi, ona ait AI takımları, AI oyuncuları ve maçları kalıcı olarak siler. İnsan takımları, oyuncuları ve paraları KORUNUR.\n\nOnaylamak için lig adını birebir yaz:`
    );
    if (typed == null) return; // iptal
    if (typed.trim() !== l.name) { setError("Lig adı eşleşmedi, silme iptal edildi."); return; }

    setDeletingId(l.id); setError(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/leagues", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: l.id, confirmName: typed.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg(`"${l.name}" silindi · ${d.deletedAiTeams} AI takım, ${d.deletedAiPlayers} AI oyuncu, ${d.deletedMatches} maç temizlendi.`);
      await load();
    } catch (e: any) { setError(e.message); } finally { setDeletingId(null); }
  }

  return (
    <div className="mb-8">
      <h2 className="font-display font-extrabold text-lg mb-3">Sistem Özeti & Ligler</h2>

      {/* Sistem kartları */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Kullanıcı" value={totals.users} />
          <StatCard label="Takım (insan/AI)" value={`${totals.humanTeams}/${totals.aiTeams}`} />
          <StatCard label="Oyuncu" value={formatNumber(totals.players)} />
          <StatCard label="Transfer" value={formatNumber(totals.transfers)} />
          <StatCard label="Lig (toplam)" value={totals.leagues} />
          <StatCard label="Aktif Lig" value={totals.activeLeagues} accent="#10B981" />
        </div>
      )}

      {loading && <div className="text-center py-8 text-text-muted">Yükleniyor…</div>}
      {error && <div className="mb-3 px-3 py-2 rounded-lg bg-danger/15 text-danger text-sm border border-danger/40">{error}</div>}
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-emerald/15 text-emerald-bright text-sm border border-emerald/40">{msg}</div>}

      {!loading && (
        <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
          <div className="grid grid-cols-[1.4fr_90px_1fr_1fr_88px_150px] gap-2 px-4 py-2.5 border-b border-border-cm text-[10px] font-bold text-text-faint uppercase">
            <span>Lig</span><span>Durum</span><span>Takım (İ/AI)</span><span>Maç</span><span>Sezon</span><span></span>
          </div>
          {leagues.length === 0 && <div className="px-4 py-8 text-center text-text-muted text-sm">Henüz lig yok.</div>}
          {leagues.map((l) => {
            const st = STATUS_LABEL[l.status] ?? { t: l.status, c: "#94A3B8" };
            const open = openId === l.id;
            return (
              <div key={l.id} className="border-b border-border-soft last:border-0">
                <div className="grid grid-cols-[1.4fr_90px_1fr_1fr_88px_150px] gap-2 px-4 py-2.5 items-center text-sm">
                  <button onClick={() => setOpenId(open ? null : l.id)} className="text-left min-w-0">
                    <div className="truncate font-medium flex items-center gap-1.5">
                      <span className="text-text-faint text-xs">{open ? "▾" : "▸"}</span>{l.name}
                    </div>
                    <div className="text-[11px] text-text-faint truncate">Kurucu: {l.creator}{l.inviteCode ? ` · Kod: ${l.inviteCode}` : ""}</div>
                  </button>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-pill text-center" style={{ background: `${st.c}22`, color: st.c }}>{st.t}</span>
                  <span className="text-text-2 text-xs">{l.humanCount}/{l.aiCount} <span className="text-text-faint">({l.teamCount})</span></span>
                  <span className="text-text-2 text-xs">{l.matchDone}/{l.matchTotal}</span>
                  <span className="text-text-2 text-xs">S{l.season}</span>
                  <button onClick={() => remove(l)} disabled={deletingId === l.id}
                    className="text-xs font-semibold py-1.5 rounded-lg border border-danger text-danger hover:bg-danger/10 disabled:opacity-50">
                    {deletingId === l.id ? "Siliniyor…" : "Ligi Sil"}
                  </button>
                </div>

                {open && (
                  <div className="px-4 pb-3 bg-panel-inset/30">
                    <div className="text-[10px] font-bold text-text-faint uppercase py-2">Puan Tablosu</div>
                    <div className="grid grid-cols-[24px_1fr_44px_50px_60px] gap-2 text-[10px] text-text-faint uppercase pb-1 border-b border-border-soft">
                      <span>#</span><span>Takım</span><span className="text-center">P</span><span className="text-center">G-B-M</span><span className="text-center">AV</span>
                    </div>
                    {l.standings.map((s, i) => (
                      <div key={s.teamId} className="grid grid-cols-[24px_1fr_44px_50px_60px] gap-2 items-center text-xs py-1 border-b border-border-soft/50 last:border-0">
                        <span className="text-text-faint">{i + 1}</span>
                        <span className="truncate flex items-center gap-1.5">{s.name}{s.isAi && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-cm/15 text-blue-cm-bright">AI</span>}</span>
                        <span className="text-center font-bold">{s.points}</span>
                        <span className="text-center text-text-2">{s.wins}-{s.draws}-{s.losses}</span>
                        <span className="text-center text-text-2">{s.gf - s.ga >= 0 ? "+" : ""}{s.gf - s.ga}</span>
                      </div>
                    ))}
                    {l.standings.length === 0 && <div className="text-xs text-text-muted py-2">Takım yok.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-panel border border-border-cm rounded-card px-4 py-3">
      <div className="section-label mb-0.5">{label}</div>
      <div className="font-display font-extrabold text-xl" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}
