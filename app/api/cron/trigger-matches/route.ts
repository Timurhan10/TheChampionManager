import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Vercel Cron her 15 dakikada bir çağırır. scheduled_at geçmiş ve status='scheduled'
// maçları bulur. Faz 3'te maç motoru burada tetiklenip maçlar tamamlanacak.
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
    .select("id, league_id, home_team_id, away_team_id, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // TODO (Faz 3): her maç için simülasyon motorunu çalıştır ve /api/matches/complete tetikle.
  return NextResponse.json({ ok: true, dueCount: due?.length ?? 0, matches: due ?? [] });
}
