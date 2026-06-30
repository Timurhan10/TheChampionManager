"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Oyuncu adı + forma numarası satır-içi düzenleme (her zaman, sadece kendi oyuncun).
export default function PlayerNameEdit({
  playerId, name, shirtNumber,
}: { playerId: string; name: string; shirtNumber: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(name);
  const [shirtVal, setShirtVal] = useState(shirtNumber != null ? String(shirtNumber) : "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function open() {
    setNameVal(name);
    setShirtVal(shirtNumber != null ? String(shirtNumber) : "");
    setErr(null);
    setEditing(true);
  }

  async function save() {
    const trimmed = nameVal.trim();
    if (!trimmed) { setErr("İsim boş olamaz."); return; }
    const shirt = shirtVal.trim() === "" ? null : Number(shirtVal);
    if (shirt !== null && (!Number.isInteger(shirt) || shirt < 1 || shirt > 99)) {
      setErr("Forma numarası 1-99 olmalı."); return;
    }
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/players/rename", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: trimmed, shirtNumber: shirt }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Kaydedilemedi.");
      setEditing(false);
      router.refresh();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  if (!editing) {
    return (
      <button onClick={open} title="İsim ve forma numarasını düzenle" className="text-text-faint hover:text-emerald text-xs ml-1">✎</button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus value={nameVal} onChange={(e) => setNameVal(e.target.value)} maxLength={100}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        placeholder="İsim"
        className="bg-panel-inset border border-emerald rounded px-1.5 py-0.5 text-sm outline-none w-32" />
      <input value={shirtVal} onChange={(e) => setShirtVal(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        placeholder="No" title="Forma numarası (1-99)"
        className="bg-panel-inset border border-emerald rounded px-1.5 py-0.5 text-sm outline-none w-12 text-center num" />
      <button onClick={save} disabled={loading} className="text-emerald text-xs">✓</button>
      <button onClick={() => setEditing(false)} className="text-text-faint text-xs">✕</button>
      {err && <span className="text-[10px] text-red-400 ml-1">{err}</span>}
    </span>
  );
}
