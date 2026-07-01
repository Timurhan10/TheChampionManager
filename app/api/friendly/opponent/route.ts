import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { loadEngineTeam } from "@/lib/match-engine/run";

// Hazırlık maçı için gerçek lig takımını (kadro + taktik) yükler.
// Yalnızca kullanıcının kendi ligindeki takımlar seçilebilir.
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId gerekli." }, { status: 400 });

  const svc = createServiceClient();
  const { data: myTeam } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!myTeam) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });
  if (teamId === myTeam.id) return NextResponse.json({ error: "Kendi takımına karşı oynayamazsın." }, { status: 400 });

  // Aynı ligde mi?
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    svc.from("league_teams").select("league_id").eq("team_id", myTeam.id),
    svc.from("league_teams").select("league_id").eq("team_id", teamId),
  ]);
  const myLeagues = new Set((mine ?? []).map((r: any) => r.league_id));
  const shared = (theirs ?? []).some((r: any) => myLeagues.has(r.league_id));
  if (!shared) return NextResponse.json({ error: "Bu takım senin liginde değil." }, { status: 403 });

  // Motor istemcide çalıştığı için kadro verisi istemciye gider; UI göstermez (kabul).
  const opponent = await loadEngineTeam(svc, teamId);
  if (!opponent.players || opponent.players.length < 11) {
    return NextResponse.json({ error: "Rakip kadrosu eksik." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, opponent });
}
