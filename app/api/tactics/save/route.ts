import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1"];
const MENTALITY = ["defensive", "balanced", "attacking"];
const PRESSING = ["low", "medium", "high"];
const TEMPO = ["slow", "normal", "fast"];
const PASS_STYLE = ["short", "mixed", "long"];

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

  // team_id unique olduğundan upsert
  const { error } = await svc.from("tactics").upsert(update, { onConflict: "team_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Server component önbelleğini tazele — aksi halde sayfa yenilenince ESKİ taktik görünür.
  revalidatePath("/tactics");
  revalidatePath("/first-eleven");
  revalidatePath("/team");

  return NextResponse.json({ ok: true });
}
