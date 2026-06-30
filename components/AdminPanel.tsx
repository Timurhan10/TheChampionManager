"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/utils";

interface AdminUser {
  id: string; email: string; username: string; credits: number; cmp: number;
  isAdmin: boolean; team: string | null; createdAt: string;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { credits: string; cmp: string; username: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUsers(d.users ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function field(u: AdminUser, key: "credits" | "cmp" | "username"): string {
    const e = edits[u.id];
    if (e) return e[key];
    return key === "username" ? u.username : String(key === "credits" ? u.credits : u.cmp);
  }
  function setField(u: AdminUser, key: "credits" | "cmp" | "username", val: string) {
    setEdits((prev) => ({
      ...prev,
      [u.id]: {
        credits: prev[u.id]?.credits ?? String(u.credits),
        cmp: prev[u.id]?.cmp ?? String(u.cmp),
        username: prev[u.id]?.username ?? u.username,
        [key]: val,
      },
    }));
  }

  async function save(u: AdminUser) {
    const e = edits[u.id];
    if (!e) return;
    setSavingId(u.id); setError(null);
    try {
      const r = await fetch("/api/admin/update-user", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, credits: Number(e.credits), cmp: Number(e.cmp), username: e.username }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSavedId(u.id);
      setTimeout(() => setSavedId(null), 1500);
      await load();
      setEdits((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
    } catch (e: any) { setError(e.message); } finally { setSavingId(null); }
  }

  const filtered = users.filter((u) =>
    !q || u.email.toLowerCase().includes(q.toLowerCase()) || (u.username ?? "").toLowerCase().includes(q.toLowerCase()) || (u.team ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-text-muted">{users.length} kullanıcı</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="E-posta / kullanıcı / takım ara…"
          className="bg-panel-inset border border-border-cm rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald w-72" />
      </div>

      {loading && <div className="text-center py-10 text-text-muted">Yükleniyor…</div>}
      {error && <div className="mb-3 px-3 py-2 rounded-lg bg-danger/15 text-danger text-sm border border-danger/40">{error}</div>}

      {!loading && (
        <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_0.9fr_84px] gap-2 px-4 py-2.5 border-b border-border-cm text-[10px] font-bold text-text-faint uppercase">
            <span>E-posta / Kullanıcı</span><span>Takım</span><span>CR</span><span>CMP</span><span>Kullanıcı Adı</span><span></span>
          </div>
          {filtered.map((u) => {
            const dirty = !!edits[u.id];
            return (
              <div key={u.id} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_0.9fr_84px] gap-2 px-4 py-2.5 items-center border-b border-border-soft last:border-0 text-sm">
                <div className="min-w-0">
                  <div className="truncate flex items-center gap-1.5">{u.email}{u.isAdmin && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald/15 text-emerald">ADMIN</span>}</div>
                  <div className="text-xs text-text-faint truncate">{u.username}</div>
                </div>
                <span className="text-text-2 truncate text-xs">{u.team ?? "—"}</span>
                <input value={field(u, "credits")} onChange={(e) => setField(u, "credits", e.target.value)} inputMode="numeric"
                  className="bg-panel-inset border border-border-cm rounded px-2 py-1 text-sm outline-none focus:border-emerald w-full" />
                <input value={field(u, "cmp")} onChange={(e) => setField(u, "cmp", e.target.value)} inputMode="numeric"
                  className="bg-panel-inset border border-border-cm rounded px-2 py-1 text-sm outline-none focus:border-emerald w-full" />
                <input value={field(u, "username")} onChange={(e) => setField(u, "username", e.target.value)}
                  className="bg-panel-inset border border-border-cm rounded px-2 py-1 text-sm outline-none focus:border-emerald w-full" />
                <button onClick={() => save(u)} disabled={!dirty || savingId === u.id}
                  className="text-xs font-semibold py-1.5 rounded-lg bg-emerald text-emerald-ink hover:bg-emerald-bright disabled:opacity-40">
                  {savingId === u.id ? "…" : savedId === u.id ? "✓" : "Kaydet"}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="px-4 py-8 text-center text-text-muted text-sm">Sonuç yok.</div>}
        </div>
      )}
    </div>
  );
}
