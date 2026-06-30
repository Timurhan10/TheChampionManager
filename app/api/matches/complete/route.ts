import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runMatch } from "@/lib/match-engine/run";
import { isAdmin } from "@/lib/admin";

// Tek bir maçı simüle edip tamamlar. (Cron veya manuel tetikleme)
export async function POST(req: Request) {
  let body: { matchId: string; returnResult?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!body.matchId) return NextResponse.json({ error: "matchId gerekli." }, { status: 400 });

  const svc = createServiceClient();

  // CRON_SECRET ile çağrı → tam yetki. Aksi halde giriş yapan kullanıcı,
  // yalnızca KENDİ maçını (takımı ev/deplasman) veya admin ise herhangi bir maçı oynatabilir.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const cronAuthorized = secret ? auth === `Bearer ${secret}` : false;

  if (!cronAuthorized) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

    const { data: match } = await svc
      .from("matches")
      .select("home_team_id, away_team_id")
      .eq("id", body.matchId)
      .maybeSingle();
    if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });

    const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
    const isParticipant = !!team && (team.id === match.home_team_id || team.id === match.away_team_id);
    if (!isParticipant && !(await isAdmin(svc, user.id))) {
      return NextResponse.json({ error: "Bu maçı yalnızca takımı sahadaysa veya admin oynatabilir." }, { status: 403 });
    }
  }

  const res = await runMatch(svc, body.matchId);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });

  // Canlı maç için sonucu (skor + olay zaman çizelgesi) istemciye döndür; istemci
  // 10 dk'lik canlı animasyonu bu sonuçtan oynatır.
  return NextResponse.json({
    ok: true,
    skipped: res.skipped ?? false,
    result: body.returnResult ? res.result ?? null : undefined,
  });
}
