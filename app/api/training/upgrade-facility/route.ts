import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { FACILITY_COSTS, FACILITY_MAX_LEVEL } from "@/lib/training";
import { formatNumber } from "@/lib/utils";

// Antrenman tesisini bir seviye yükseltir (CR harcayarak).
// Seviye antrenman kazancını kalıcı çarpar (facilityCoef) — CR gideri + gelişim yatırımı.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id, training_facility_level").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const current = (team as any).training_facility_level ?? 1;
  if (current >= FACILITY_MAX_LEVEL) return NextResponse.json({ error: "Tesis zaten en üst seviyede." }, { status: 400 });
  const next = current + 1;
  const cost = FACILITY_COSTS[next];
  if (!cost) return NextResponse.json({ error: "Geçersiz seviye." }, { status: 400 });

  const { data: gameUser } = await svc.from("users").select("credits").eq("id", user.id).single();
  if (!gameUser) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 400 });
  if (gameUser.credits < cost) return NextResponse.json({ error: `Yetersiz CR (gereken: ${formatNumber(cost)}).` }, { status: 400 });

  // Önce seviye koşullu artırılır (çift tıklama iki kez yükseltemesin), sonra ücret düşülür.
  const { data: upd, error } = await svc.from("teams")
    .update({ training_facility_level: next })
    .eq("id", team.id).eq("training_facility_level", current)
    .select("id");
  if (error || !upd?.length) return NextResponse.json({ error: "Yükseltme çakıştı, tekrar dene." }, { status: 409 });

  await svc.rpc("add_credits", { uid: user.id, delta: -cost });

  revalidatePath("/training");
  return NextResponse.json({ ok: true, level: next, cost });
}
