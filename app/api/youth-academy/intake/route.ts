import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generatePlayer } from "@/lib/player-generator";
import type { Position } from "@/types/game";

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];

// Sezon sonu (veya manuel) genç oyuncu üretimi: 1-3 oyuncu, 16-19 yaş, yüksek potansiyel.
// Üretilen oyuncular gizli başlar (scouting ile açılır), is_youth_academy = true.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: academy } = await svc.from("youth_academy").select("*").eq("team_id", team.id).maybeSingle();
  if (!academy?.is_active) return NextResponse.json({ error: "Önce alt yapıyı aktif et." }, { status: 400 });

  const count = 1 + Math.floor(Math.random() * 3); // 1-3
  const rows = Array.from({ length: count }).map(() => {
    const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const age = 16 + Math.floor(Math.random() * 4); // 16-19
    const gen = generatePlayer({ position, age, isYouth: true, attrMin: 6, attrMax: 11 });
    // Yüksek potansiyel garanti (14-20)
    const potential = 14 + Math.floor(Math.random() * 7);
    return {
      team_id: team.id, name: gen.name, age, position,
      is_youth_academy: true, potential, value_cr: gen.value_cr,
      ...gen.attributes,
    };
  });

  const { error } = await svc.from("players").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await svc.from("youth_academy").update({ last_intake_at: new Date().toISOString() }).eq("team_id", team.id);

  return NextResponse.json({ ok: true, count });
}
