import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { activateLeague } from "@/lib/league-service";

// Lig kurucusu eksik slotları AI ile doldurup ligi manuel başlatır.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { leagueId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: league } = await svc.from("leagues").select("creator_id, status").eq("id", body.leagueId).maybeSingle();
  if (!league) return NextResponse.json({ error: "Lig bulunamadı." }, { status: 404 });
  if (league.creator_id !== user.id)
    return NextResponse.json({ error: "Sadece lig kurucusu başlatabilir." }, { status: 403 });
  if (league.status !== "waiting")
    return NextResponse.json({ error: "Lig zaten başlatılmış." }, { status: 400 });

  const res = await activateLeague(svc, body.leagueId);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true, leagueId: body.leagueId });
}
