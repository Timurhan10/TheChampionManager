"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcademyToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/youth-academy/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      router.refresh();
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`relative w-14 h-7 rounded-full transition-colors ${active ? "bg-emerald" : "bg-panel-inset border border-border-cm"} disabled:opacity-50`}>
      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${active ? "left-[30px]" : "left-0.5"}`} />
    </button>
  );
}

export function IntakeButton({ active }: { active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function intake() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/youth-academy/intake", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`${data.count} genç oyuncu alt yapıdan çıktı!`);
      router.refresh();
    } catch (e: any) { setMsg(e.message); } finally { setLoading(false); }
  }

  return (
    <div>
      <button onClick={intake} disabled={!active || loading}
        className="bg-emerald text-emerald-ink font-semibold px-4 py-2 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
        {loading ? "..." : "Genç Oyuncu Üret (Sezon Sonu Simülasyonu)"}
      </button>
      {msg && <p className="text-xs text-emerald-bright mt-2">{msg}</p>}
    </div>
  );
}
