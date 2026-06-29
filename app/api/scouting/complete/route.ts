import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";

// Cron ile tetiklenir: vadesi gelen pending scout raporlarını tamamlar.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = new Date().toISOString();

  const { data: due, error } = await svc
    .from("scouting_reports")
    .select("id, scout_team_id, target_player_id")
    .eq("status", "pending")
    .lte("completes_at", now);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let completed = 0;
  for (const r of due ?? []) {
    const { error: updErr } = await svc.from("scouting_reports").update({ status: "completed" }).eq("id", r.id).eq("status", "pending");
    if (updErr) continue;
    completed++;
    const { data: st } = await svc.from("teams").select("user_id").eq("id", r.scout_team_id).maybeSingle();
    const { data: pl } = await svc.from("players").select("name").eq("id", r.target_player_id).maybeSingle();
    if (st?.user_id) await notify(svc, st.user_id, "scout_complete", `Scout raporu hazır: ${pl?.name ?? "Oyuncu"}`, "Özellikler açıldı.");
  }

  return NextResponse.json({ ok: true, completed });
}
