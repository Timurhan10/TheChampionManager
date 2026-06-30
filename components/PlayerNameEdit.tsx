"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Oyuncu adı satır-içi düzenleme (lig başlamadan + transfer yapılmadan).
export default function PlayerNameEdit({ playerId, name }: { playerId: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!value.trim() || value.trim() === name) { setEditing(false); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/players/rename", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: value.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setEditing(false);
      router.refresh();
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} title="İsmi düzenle" className="text-text-faint hover:text-emerald text-xs ml-1">✎</button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={100}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="bg-panel-inset border border-emerald rounded px-1.5 py-0.5 text-sm outline-none w-36" />
      <button onClick={save} disabled={loading} className="text-emerald text-xs">✓</button>
      <button onClick={() => setEditing(false)} className="text-text-faint text-xs">✕</button>
    </span>
  );
}
