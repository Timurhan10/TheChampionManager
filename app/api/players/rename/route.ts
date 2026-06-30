import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getTeamEditability } from "@/lib/team-guard";

// Lig başlamadan + transfer yapılmadan oyuncu adını düzenler.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { playerId: string; name: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "İsim boş olamaz." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: player } = await svc.from("players").select("id, team_id").eq("id", body.playerId).maybeSingle();
  if (!player || player.team_id !== team.id) return NextResponse.json({ error: "Bu oyuncu sana ait değil." }, { status: 403 });

  const { editable, inActiveLeague } = await getTeamEditability(svc, team.id);
  if (!editable) {
    return NextResponse.json({ error: inActiveLeague ? "Lig başladıktan sonra isim değiştirilemez." : "Transfer yaptığın için isim değiştirilemez." }, { status: 400 });
  }

  await svc.from("players").update({ name: name.slice(0, 100) }).eq("id", player.id);
  return NextResponse.json({ ok: true });
}
