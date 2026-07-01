import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runMatch } from "@/lib/match-engine/run";
import { processSales } from "@/lib/sales";
import { rotateFreeAgents } from "@/lib/free-agents";
import { computeValue } from "@/lib/player-generator";
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

  // 1) Maçlar — insan maçları otomatik oynanmaz (kullanıcı canlı oynasın).
  //    Yalnızca AI-vs-AI maçlar, ya da kullanıcı gelmediği için çok geciken (grace
  //    penceresini aşan) maçlar otomatik tamamlanır; böylece lig tıkanmaz.
  const GRACE_MS = 3 * 24 * 3600 * 1000; // 3 gün
  try {
    const { data: due } = await svc
      .from("matches")
      .select("id, home_team_id, away_team_id, scheduled_at")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);
    let played = 0, skippedHuman = 0;
    for (const m of due ?? []) {
      const { data: ts } = await svc.from("teams").select("id, is_ai").in("id", [(m as any).home_team_id, (m as any).away_team_id]);
      const anyHuman = (ts ?? []).some((t: any) => !t.is_ai);
      const overdue = Date.now() - new Date((m as any).scheduled_at).getTime() > GRACE_MS;
      if (anyHuman && !overdue) { skippedHuman++; continue; } // kullanıcı canlı oynayacak
      const r = await runMatch(svc, (m as any).id);
      if (!r.error && !r.skipped) played++;
    }
    result.matchesPlayed = played;
    result.matchesSkippedHuman = skippedHuman;
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

  // 4) Transfer pazarı rotasyonu (12s gate; günlük taban)
  try {
    result.marketRefresh = await rotateFreeAgents(svc);
  } catch (e: any) { result.marketError = e.message; }

  // 5) Oyuncu değerlerini tazele (insan takımları, ~günde bir — app_state gate).
  //    Antrenman anında güncelliyor; bu adım maç reytingi/yaş gibi zamanla değişen
  //    etkilerin de değere yansımasını garanti eden günlük süpürme.
  try {
    const VALUES_KEY = "player_values_refreshed_at";
    const VALUES_INTERVAL_MS = 20 * 3600 * 1000; // 20 saat (cron saati kayarsa da günlük kalsın)
    const { data: st } = await svc.from("app_state").select("value").eq("key", VALUES_KEY).maybeSingle();
    const last = st?.value ? new Date(String(st.value)).getTime() : 0;
    if (!Number.isFinite(last) || Date.now() - last >= VALUES_INTERVAL_MS) {
      const { data: humanTeams } = await svc.from("teams").select("id").eq("is_ai", false);
      const teamIds = (humanTeams ?? []).map((t: any) => t.id);
      let updated = 0;
      if (teamIds.length) {
        const { data: players } = await svc.from("players").select("*").in("team_id", teamIds);
        for (const p of players ?? []) {
          const v = computeValue(p as any, (p as any).position, (p as any).age, (p as any).potential ?? null);
          if (v !== (p as any).value_cr) {
            const { error } = await svc.from("players").update({ value_cr: v }).eq("id", (p as any).id);
            if (!error) updated++;
          }
        }
      }
      await svc.from("app_state").upsert(
        { key: VALUES_KEY, value: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      result.playerValuesUpdated = updated;
    } else {
      result.playerValuesUpdated = "skipped";
    }
  } catch (e: any) { result.valuesError = e.message; }

  return NextResponse.json({ ok: true, ...result });
}
