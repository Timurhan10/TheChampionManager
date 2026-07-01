import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runTraining, TRAINING_TYPES, type TrainingKind } from "@/lib/training";
import { computeValue } from "@/lib/player-generator";
import type { Player } from "@/types/game";

const DAILY_LIMIT = 3;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { playerId: string; kind: TrainingKind };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  if (!TRAINING_TYPES[body.kind]) return NextResponse.json({ error: "Geçersiz antrenman türü." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id, training_facility_level").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: player } = await svc.from("players").select("*").eq("id", body.playerId).maybeSingle();
  if (!player || (player as any).team_id !== team.id) return NextResponse.json({ error: "Bu oyuncu sana ait değil." }, { status: 403 });

  // Günlük limit (UTC gün): takım 3, oyuncu 1
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const iso = dayStart.toISOString();
  const { data: todays } = await svc.from("training_sessions").select("player_id").eq("team_id", team.id).gte("created_at", iso);
  const usedToday = (todays ?? []).length;
  if (usedToday >= DAILY_LIMIT) return NextResponse.json({ error: `Bugünlük antrenman hakkın bitti (${DAILY_LIMIT}/${DAILY_LIMIT}).` }, { status: 400 });
  if ((todays ?? []).some((t: any) => t.player_id === body.playerId)) {
    return NextResponse.json({ error: "Bu oyuncu bugün zaten antrenman yaptı." }, { status: 400 });
  }

  const facility = (team as any).training_facility_level ?? 1;
  const result = runTraining(player as Player, body.kind, facility);

  // Persist: özellik integer artışları + kesirli birikim.
  // Değer canlanır: güncel attribute'larla piyasa değeri yeniden hesaplanır —
  // gelişim satış değerine ANINDA yansır (al-geliştir-sat döngüsü).
  const updatedAttrs = { ...(player as any), ...result.attrPatch };
  const newValue = computeValue(updatedAttrs, (player as any).position, (player as any).age, (player as any).potential ?? null);
  const patch: Record<string, any> = { training_progress: result.progress, ...result.attrPatch, value_cr: newValue };
  await svc.from("players").update(patch).eq("id", body.playerId);
  await svc.from("training_sessions").insert({ team_id: team.id, player_id: body.playerId, kind: body.kind });

  revalidatePath("/training");
  revalidatePath("/team");

  return NextResponse.json({
    ok: true,
    failed: result.failed,
    gains: result.gains,
    remaining: DAILY_LIMIT - (usedToday + 1),
    valueBefore: (player as any).value_cr ?? 0,
    valueAfter: newValue,
  });
}
