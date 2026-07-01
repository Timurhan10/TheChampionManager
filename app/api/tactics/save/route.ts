import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { STYLE_PRESETS } from "@/lib/tactic-styles";

const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1"];
const MENTALITY = ["defensive", "balanced", "attacking"];
const PRESSING = ["low", "medium", "high"];
const TEMPO = ["slow", "normal", "fast"];
const PASS_STYLE = ["short", "mixed", "long"];
const WIDTH = ["narrow", "normal", "wide"];
const DEF_LINE = ["low", "medium", "high"];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const update: Record<string, any> = { team_id: team.id, updated_at: new Date().toISOString() };
  if (FORMATIONS.includes(body.formation)) update.formation = body.formation;
  if (MENTALITY.includes(body.mentality)) update.mentality = body.mentality;
  if (PRESSING.includes(body.pressing)) update.pressing = body.pressing;
  if (TEMPO.includes(body.tempo)) update.tempo = body.tempo;
  if (PASS_STYLE.includes(body.pass_style)) update.pass_style = body.pass_style;
  if (body.lineup && typeof body.lineup === "object") update.lineup = body.lineup;
  if (Array.isArray(body.substitutes)) update.substitutes = body.substitutes;
  if (body.player_instructions && typeof body.player_instructions === "object") update.player_instructions = body.player_instructions;

  // Taktik v2: stil + ince ayarlar
  if (body.style === null || (typeof body.style === "string" && body.style in STYLE_PRESETS)) update.style = body.style;
  if (body.advanced && typeof body.advanced === "object") {
    const a = body.advanced;
    const clean: Record<string, unknown> = {};
    if (WIDTH.includes(a.width)) clean.width = a.width;
    if (DEF_LINE.includes(a.defensive_line)) clean.defensive_line = a.defensive_line;
    if (typeof a.time_wasting === "boolean") clean.time_wasting = a.time_wasting;
    if (typeof a.counter_attack === "boolean") clean.counter_attack = a.counter_attack;
    update.advanced = clean;
  }

  // team_id unique olduğundan upsert
  const { error } = await svc.from("tactics").upsert(update, { onConflict: "team_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Server component önbelleğini tazele — aksi halde sayfa yenilenince ESKİ taktik görünür.
  revalidatePath("/tactics");
  revalidatePath("/first-eleven");
  revalidatePath("/team");

  return NextResponse.json({ ok: true });
}
