"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCR } from "@/lib/utils";

export interface TaskRow {
  key: string;
  title: string;
  description: string;
  target: number;
  rewardCr: number;
  rewardCmp: number;
  progress: number;
  claimed: boolean;
}

export default function TasksClient({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [claimedKeys, setClaimedKeys] = useState<string[]>(tasks.filter((t) => t.claimed).map((t) => t.key));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastReward, setLastReward] = useState<{ cr: number; cmp: number } | null>(null);

  async function claim(key: string) {
    setBusy(key); setErr(null); setLastReward(null);
    try {
      const res = await fetch("/api/tasks/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskKey: key }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setClaimedKeys((x) => [...x, key]);
      setLastReward({ cr: d.rewardCr, cmp: d.rewardCmp });
      router.refresh();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="max-w-2xl">
      {lastReward && (
        <div className="mb-4 bg-emerald/10 border border-emerald/40 rounded-card px-4 py-3 text-sm">
          Ödül alındı: <b className="text-emerald">+{formatCR(lastReward.cr)}</b>
          {lastReward.cmp > 0 && <> · <b className="text-blue-cm-bright">+{lastReward.cmp} CMP</b></>}
        </div>
      )}
      {err && <div className="mb-4 bg-danger/10 border border-danger/40 rounded-card px-4 py-3 text-sm text-danger">{err}</div>}

      <div className="space-y-3">
        {tasks.map((t) => {
          const done = t.progress >= t.target;
          const claimed = claimedKeys.includes(t.key);
          const pct = Math.round((t.progress / t.target) * 100);
          return (
            <div key={t.key} className={cn("bg-panel border rounded-card p-4", claimed ? "border-border-soft opacity-70" : done ? "border-emerald/50" : "border-border-cm")}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-[15px]">{t.title}</span>
                    {claimed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald/15 text-emerald">ALINDI ✓</span>}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{t.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 max-w-[220px] h-2 rounded-full bg-panel-inset overflow-hidden">
                      <div className={cn("h-full rounded-full", done ? "bg-emerald" : "bg-blue-cm")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-text-faint tabular-nums">{t.progress}/{t.target}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] text-emerald font-semibold">+{formatCR(t.rewardCr)}</div>
                  {t.rewardCmp > 0 && <div className="text-[11px] text-blue-cm-bright">+{t.rewardCmp} CMP</div>}
                  <button onClick={() => claim(t.key)} disabled={!done || claimed || busy === t.key}
                    className={cn("mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border",
                      done && !claimed
                        ? "bg-emerald text-emerald-ink border-emerald hover:bg-emerald-bright"
                        : "border-border-cm text-text-faint")}>
                    {claimed ? "Alındı" : busy === t.key ? "…" : done ? "Ödülü Al" : "Devam"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-faint mt-4">
        İlerleme oyun içi eylemlerinden otomatik hesaplanır; ödüller gün sonunda sıfırlanır, almayı unutma.
      </p>
    </div>
  );
}
