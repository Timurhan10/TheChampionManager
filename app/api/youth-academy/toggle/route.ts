import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Alt yapıyı aktif/pasif yapar.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { active: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: existing } = await svc.from("youth_academy").select("id").eq("team_id", team.id).maybeSingle();
  const patch = {
    team_id: team.id,
    is_active: body.active,
    activated_at: body.active ? new Date().toISOString() : null,
  };

  if (existing) {
    await svc.from("youth_academy").update(patch).eq("team_id", team.id);
  } else {
    await svc.from("youth_academy").insert(patch);
  }

  return NextResponse.json({ ok: true, active: body.active });
}
