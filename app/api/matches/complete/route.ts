import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runMatch } from "@/lib/match-engine/run";

// Tek bir maçı simüle edip tamamlar. (Cron veya manuel tetikleme)
export async function POST(req: Request) {
  // CRON_SECRET varsa onunla, yoksa giriş yapmış kullanıcıyla izin ver
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  let authorized = secret ? auth === `Bearer ${secret}` : false;

  if (!authorized) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    authorized = !!user;
  }
  if (!authorized) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { matchId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!body.matchId) return NextResponse.json({ error: "matchId gerekli." }, { status: 400 });

  const svc = createServiceClient();
  const res = await runMatch(svc, body.matchId);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true, skipped: res.skipped ?? false });
}
