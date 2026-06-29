import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils";
import type { MatchDay } from "@/lib/schedule-generator";

const VALID_DAYS: MatchDay[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { name: string; matchDay1: MatchDay; matchDay2: MatchDay; matchTime: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { name, matchDay1, matchDay2, matchTime } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Lig adı zorunlu." }, { status: 400 });
  if (!VALID_DAYS.includes(matchDay1) || !VALID_DAYS.includes(matchDay2))
    return NextResponse.json({ error: "Geçersiz maç günü." }, { status: 400 });
  if (matchDay1 === matchDay2)
    return NextResponse.json({ error: "İki maç günü farklı olmalı." }, { status: 400 });
  if (!/^\d{2}:\d{2}$/.test(matchTime ?? ""))
    return NextResponse.json({ error: "Geçersiz saat (SS:DD)." }, { status: 400 });

  const svc = createServiceClient();

  // Kullanıcının takımı
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Önce takım kurmalısın." }, { status: 400 });

  // Benzersiz davet kodu (çakışmada birkaç kez dene)
  let inviteCode = generateInviteCode();
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await svc.from("leagues").select("id").eq("invite_code", inviteCode).maybeSingle();
    if (!exists) break;
    inviteCode = generateInviteCode();
  }

  const { data: league, error: leagueErr } = await svc
    .from("leagues")
    .insert({
      name: name.trim(),
      creator_id: user.id,
      match_day_1: matchDay1,
      match_day_2: matchDay2,
      match_time: matchTime,
      status: "waiting",
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (leagueErr || !league)
    return NextResponse.json({ error: leagueErr?.message ?? "Lig oluşturulamadı." }, { status: 400 });

  // Kurucunun takımını lige ekle
  const { error: ltErr } = await svc.from("league_teams").insert({ league_id: league.id, team_id: team.id });
  if (ltErr) return NextResponse.json({ error: ltErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, leagueId: league.id, inviteCode });
}
