import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SCOUT_UPGRADE_CMP } from "@/lib/scouting";

// Scout seviyesini yükseltir (max 3) — CMP ile (300 CMP).
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id, scout_level").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });
  if ((team.scout_level ?? 1) >= 3) return NextResponse.json({ error: "Scout zaten maksimum seviyede." }, { status: 400 });

  const { data: gameUser } = await svc.from("users").select("cmp_points").eq("id", user.id).single();
  if (!gameUser || gameUser.cmp_points < SCOUT_UPGRADE_CMP) {
    return NextResponse.json({ error: "Yetersiz CMP." }, { status: 400 });
  }

  await svc.from("teams").update({ scout_level: (team.scout_level ?? 1) + 1 }).eq("id", team.id);
  await svc.from("users").update({ cmp_points: gameUser.cmp_points - SCOUT_UPGRADE_CMP }).eq("id", user.id);

  return NextResponse.json({ ok: true, level: (team.scout_level ?? 1) + 1 });
}
