import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { activateLeague } from "@/lib/league-service";
import { LEAGUE_SIZE } from "@/lib/constants";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { inviteCode: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const code = body.inviteCode?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Davet kodu gerekli." }, { status: 400 });

  const svc = createServiceClient();

  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Önce takım kurmalısın." }, { status: 400 });

  const { data: league } = await svc.from("leagues").select("*").eq("invite_code", code).maybeSingle();
  if (!league) return NextResponse.json({ error: "Lig bulunamadı." }, { status: 404 });
  if (league.status !== "waiting")
    return NextResponse.json({ error: "Bu lig zaten başlamış." }, { status: 400 });

  // Mevcut takımlar
  const { data: lt } = await svc.from("league_teams").select("team_id").eq("league_id", league.id);
  const teamIds: string[] = (lt ?? []).map((r: any) => r.team_id);

  if (teamIds.includes(team.id))
    return NextResponse.json({ error: "Zaten bu ligdesin." }, { status: 400 });
  if (teamIds.length >= LEAGUE_SIZE)
    return NextResponse.json({ error: "Lig dolu." }, { status: 400 });

  const { error: joinErr } = await svc
    .from("league_teams")
    .insert({ league_id: league.id, team_id: team.id });
  if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 400 });

  // 12 insan takımına ulaşıldıysa otomatik başlat
  let activated = false;
  if (teamIds.length + 1 >= LEAGUE_SIZE) {
    const res = await activateLeague(svc, league.id);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    activated = true;
  }

  return NextResponse.json({ ok: true, leagueId: league.id, activated });
}
