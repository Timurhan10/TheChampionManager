import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { mentorEligibilityError, MENTOR_MAX_MENTEES } from "@/lib/training";
import { overallRating } from "@/lib/player-generator";

// Mentor ata/kaldır. Kurallar sunucuda doğrulanır:
// mentor yaş ≥29, genel puan ≥ mentee+2, aynı pozisyon, mentor başına en fazla 2 mentee.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { menteeId: string; mentorId: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  if (!body.menteeId) return NextResponse.json({ error: "Oyuncu seçilmedi." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: mentee } = await svc.from("players").select("*").eq("id", body.menteeId).maybeSingle();
  if (!mentee || (mentee as any).team_id !== team.id) return NextResponse.json({ error: "Bu oyuncu sana ait değil." }, { status: 403 });

  // Kaldırma
  if (!body.mentorId) {
    await svc.from("players").update({ mentor_id: null }).eq("id", body.menteeId);
    revalidatePath("/training");
    return NextResponse.json({ ok: true, mentorId: null });
  }

  const { data: mentor } = await svc.from("players").select("*").eq("id", body.mentorId).maybeSingle();
  if (!mentor || (mentor as any).team_id !== team.id) return NextResponse.json({ error: "Mentor sana ait değil." }, { status: 403 });

  const err = mentorEligibilityError(
    { id: (mentor as any).id, age: (mentor as any).age, position: (mentor as any).position, overall: overallRating(mentor as any, (mentor as any).position) },
    { id: (mentee as any).id, age: (mentee as any).age, position: (mentee as any).position, overall: overallRating(mentee as any, (mentee as any).position) },
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const { count } = await svc.from("players").select("id", { count: "exact", head: true })
    .eq("mentor_id", body.mentorId).neq("id", body.menteeId);
  if ((count ?? 0) >= MENTOR_MAX_MENTEES) {
    return NextResponse.json({ error: `Bu mentorun zaten ${MENTOR_MAX_MENTEES} öğrencisi var.` }, { status: 400 });
  }

  await svc.from("players").update({ mentor_id: body.mentorId }).eq("id", body.menteeId);
  revalidatePath("/training");
  return NextResponse.json({ ok: true, mentorId: body.mentorId });
}
