import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Canlı motorla oynanan hazırlık maçını geçmişe kaydeder (reyting/para/puan ETKİLENMEZ).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { opponentName?: string; homeScore?: number; awayScore?: number; stats?: any; motm?: any; ratings?: any[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  if (typeof body.homeScore !== "number" || typeof body.awayScore !== "number") {
    return NextResponse.json({ error: "Skor gerekli." }, { status: 400 });
  }
  if (body.homeScore + body.awayScore > 15) return NextResponse.json({ error: "Skor makul değil." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  try {
    await svc.from("matches").insert({
      league_id: null,
      home_team_id: team.id,
      away_team_id: null,
      scheduled_at: new Date().toISOString(),
      status: "finished",
      home_score: body.homeScore,
      away_score: body.awayScore,
      match_events: {
        friendly: true,
        opponentName: (body.opponentName ?? "Rakip").slice(0, 60),
        stats: body.stats ?? null,
        motm: body.motm ?? null,
        ratings: (body.ratings ?? []).slice(0, 25),
      },
    });
  } catch { /* geçmiş kaydı kritik değil */ }

  revalidatePath("/friendlies");
  return NextResponse.json({ ok: true });
}
