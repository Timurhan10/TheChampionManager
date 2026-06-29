import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePlayer, validateSquad } from "@/lib/player-generator";
import type { Position } from "@/types/game";

interface OnboardingPayload {
  username: string;
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  players: { name: string; position: Position }[];
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let body: OnboardingPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { username, teamName, primaryColor, secondaryColor, players } = body;

  if (!username?.trim() || !teamName?.trim()) {
    return NextResponse.json({ error: "Kullanıcı adı ve takım adı zorunlu." }, { status: 400 });
  }

  const positions = (players ?? []).map((p) => p.position);
  const squadError = validateSquad(positions);
  if (squadError) {
    return NextResponse.json({ error: squadError }, { status: 400 });
  }

  // 1) Kullanıcı satırı (varsa atla) — 100.000 CR başlangıç
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingUser) {
    const { error: userErr } = await supabase.from("users").insert({
      id: user.id,
      username: username.trim(),
      credits: 100000,
      cmp_points: 0,
    });
    if (userErr) {
      const msg = userErr.code === "23505" ? "Bu kullanıcı adı alınmış." : userErr.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // 2) Takım — kullanıcı başına tek takım
  const { data: existingTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingTeam) {
    return NextResponse.json({ error: "Zaten bir takımın var." }, { status: 400 });
  }

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      name: teamName.trim(),
      primary_color: primaryColor || "#10B981",
      secondary_color: secondaryColor || "#1A2A3E",
      is_ai: false,
    })
    .select()
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: teamErr?.message ?? "Takım oluşturulamadı." }, { status: 400 });
  }

  // 3) 25 oyuncuyu sunucuda üret (attribute/potansiyel/değer güvenli üretilir)
  const rows = players.map((p) => {
    const gen = generatePlayer({ name: p.name?.trim() || undefined, position: p.position });
    return {
      team_id: team.id,
      name: gen.name,
      age: gen.age,
      position: gen.position,
      is_youth_academy: false,
      potential: gen.potential,
      value_cr: gen.value_cr,
      ...gen.attributes,
    };
  });

  const { error: playersErr } = await supabase.from("players").insert(rows);
  if (playersErr) {
    return NextResponse.json({ error: playersErr.message }, { status: 400 });
  }

  // 4) Varsayılan taktik + alt yapı kaydı
  await supabase.from("tactics").insert({ team_id: team.id });
  await supabase.from("youth_academy").insert({ team_id: team.id });

  return NextResponse.json({ ok: true, teamId: team.id });
}
