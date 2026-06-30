import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runMatch } from "@/lib/match-engine/run";
import { processSales } from "@/lib/sales";
import { notify } from "@/lib/notifications";

// Tek günlük cron orkestratörü (Vercel Hobby cron sayısı sınırı için birleştirildi):
//  1) Vadesi gelen maçları simüle et
//  2) Tamamlanan scout raporlarını işle
//  3) Satılık oyuncuları işle (otomatik satış)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  const svc = createServiceClient();
  const now = new Date().toISOString();
  const result: Record<string, unknown> = {};

  // 1) Maçlar
  try {
    const { data: due } = await svc.from("matches").select("id").eq("status", "scheduled").lte("scheduled_at", now);
    let played = 0;
    for (const m of due ?? []) {
      const r = await runMatch(svc, (m as any).id);
      if (!r.error && !r.skipped) played++;
    }
    result.matchesPlayed = played;
  } catch (e: any) { result.matchesError = e.message; }

  // 2) Scouting
  try {
    const { data: reports } = await svc.from("scouting_reports").select("id, scout_team_id, target_player_id").eq("status", "pending").lte("completes_at", now);
    let completed = 0;
    for (const r of reports ?? []) {
      const { error } = await svc.from("scouting_reports").update({ status: "completed" }).eq("id", (r as any).id).eq("status", "pending");
      if (error) continue;
      completed++;
      const { data: st } = await svc.from("teams").select("user_id").eq("id", (r as any).scout_team_id).maybeSingle();
      const { data: pl } = await svc.from("players").select("name").eq("id", (r as any).target_player_id).maybeSingle();
      if (st?.user_id) await notify(svc, st.user_id, "scout_complete", `Scout raporu hazır: ${pl?.name ?? "Oyuncu"}`, "Özellikler açıldı.");
    }
    result.scoutsCompleted = completed;
  } catch (e: any) { result.scoutError = e.message; }

  // 3) Satışlar
  try {
    result.sales = await processSales(svc);
  } catch (e: any) { result.salesError = e.message; }

  return NextResponse.json({ ok: true, ...result });
}
