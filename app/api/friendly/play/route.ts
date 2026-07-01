import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { simulateMatch, type EngineTeam } from "@/lib/match-engine/simulator";
import { generatePlayer } from "@/lib/player-generator";
import type { Player, Tactics, Position } from "@/types/game";

const DIFFICULTY: Record<string, { label: string; range: [number, number] }> = {
  easy: { label: "Kolay", range: [7, 11] },
  medium: { label: "Orta", range: [9, 13] },
  hard: { label: "Zor", range: [12, 16] },
};

// Rakip kadro (geçici, kaydedilmez): pozisyon karışımıyla 14 oyuncu üretir.
function buildOpponent(name: string, range: [number, number]): EngineTeam {
  const plan: Position[] = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW", "FW", "DF", "FW"];
  const players: Player[] = plan.map((position) => {
    const g = generatePlayer({ position, attrMin: range[0], attrMax: range[1] });
    return {
      id: (globalThis.crypto?.randomUUID?.() ?? `opp-${Math.random()}`),
      team_id: "friendly-opponent",
      name: g.name, age: g.age, position,
      is_youth_academy: false, potential: g.potential, value_cr: g.value_cr,
      for_sale: false, asking_price: null,
      ...g.attributes,
    } as unknown as Player;
  });
  return { teamId: "friendly-opponent", name, isAi: true, players, tactics: null };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { difficulty?: string; opponentName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const diff = DIFFICULTY[body.difficulty ?? "medium"] ?? DIFFICULTY.medium;

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id, name").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: players } = await svc.from("players").select("*").eq("team_id", team.id);
  if (!players || players.length < 11) return NextResponse.json({ error: "Hazırlık maçı için en az 11 oyuncun olmalı." }, { status: 400 });
  const { data: tactics } = await svc.from("tactics").select("*").eq("team_id", team.id).maybeSingle();

  const home: EngineTeam = {
    teamId: team.id, name: team.name, isAi: false,
    players: players as Player[], tactics: (tactics as Tactics) ?? null,
  };
  const away = buildOpponent(body.opponentName?.trim() || `${diff.label} Rakip`, diff.range);

  // Simülasyon — reyting/para/puan ETKİLENMEZ. Yalnızca geçmiş için maç kaydı tutulur.
  const result = simulateMatch(home, away);
  const homeRatings = result.playerRatings.filter((r) => r.team === "home");

  // Geçmiş kaydı: matches tablosuna (league_id NULL = hazırlık maçı, away_team_id NULL = geçici rakip).
  // Kolon/şema sorunlarında sessizce atla — maç sonucu yine döner.
  try {
    await svc.from("matches").insert({
      league_id: null,
      home_team_id: team.id,
      away_team_id: null,
      scheduled_at: new Date().toISOString(),
      status: "finished",
      home_score: result.homeScore,
      away_score: result.awayScore,
      match_events: {
        friendly: true,
        opponentName: away.name,
        stats: result.stats,
        motm: result.manOfTheMatch,
        ratings: homeRatings,
      },
    });
  } catch { /* geçmiş kaydı kritik değil */ }

  return NextResponse.json({
    ok: true,
    home: { name: home.name, score: result.homeScore },
    away: { name: away.name, score: result.awayScore },
    motm: result.manOfTheMatch,
    stats: result.stats,
    ratings: homeRatings,
    events: result.events, // canlı animasyon için olay zaman çizelgesi
  });
}
