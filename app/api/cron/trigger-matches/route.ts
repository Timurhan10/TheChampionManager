import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runMatch } from "@/lib/match-engine/run";

// Vercel Cron her 15 dakikada bir çağırır. scheduled_at geçmiş ve status='scheduled'
// maçları bulup simülasyon motorunu çalıştırır ve tamamlar.
export async function GET(req: Request) {
  // Basit koruma: CRON_SECRET header'ı
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  const svc = createServiceClient();
  const now = new Date().toISOString();

  const { data: due, error } = await svc
    .from("matches")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let played = 0;
  for (const m of due ?? []) {
    const res = await runMatch(svc, m.id);
    if (!res.error && !res.skipped) played++;
  }

  return NextResponse.json({ ok: true, dueCount: due?.length ?? 0, played });
}
