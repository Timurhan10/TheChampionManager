import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { deleteLeagueCascade } from "@/lib/league-delete";

async function guard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Yetkisiz." }, { status: 401 }) };
  const svc = createServiceClient();
  if (!(await isAdmin(svc, user.id))) {
    return { error: NextResponse.json({ error: "Yetkisiz (admin değil)." }, { status: 403 }) };
  }
  return { svc };
}

async function count(svc: any, table: string, filter?: (q: any) => any): Promise<number> {
  let q = svc.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

// GET — tüm ligler + detay + sistem toplamları (sadece admin)
export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  const svc = g.svc;

  const [{ data: leagues }, { data: teams }, { data: lt }, { data: gameUsers }] = await Promise.all([
    svc.from("leagues").select("id, name, status, season_number, invite_code, created_at, creator_id").order("created_at", { ascending: false }),
    svc.from("teams").select("id, name, is_ai, user_id"),
    svc.from("league_teams").select("league_id, team_id, points, wins, draws, losses, goals_for, goals_against"),
    svc.from("users").select("id, username"),
  ]);

  const teamById = new Map((teams ?? []).map((t: any) => [t.id, t]));
  const usernameById = new Map((gameUsers ?? []).map((u: any) => [u.id, u.username]));

  // Lig başına maç sayıları
  const { data: matchRows } = await svc.from("matches").select("league_id, status");
  const matchTotalByLeague = new Map<string, number>();
  const matchDoneByLeague = new Map<string, number>();
  for (const m of matchRows ?? []) {
    const lid = (m as any).league_id;
    if (!lid) continue;
    matchTotalByLeague.set(lid, (matchTotalByLeague.get(lid) ?? 0) + 1);
    if ((m as any).status === "finished") matchDoneByLeague.set(lid, (matchDoneByLeague.get(lid) ?? 0) + 1);
  }

  // Lig başına takımlar (puan tablosu)
  const standingsByLeague = new Map<string, any[]>();
  for (const row of lt ?? []) {
    const lid = (row as any).league_id;
    const team = teamById.get((row as any).team_id);
    const arr = standingsByLeague.get(lid) ?? [];
    arr.push({
      teamId: (row as any).team_id,
      name: team?.name ?? "—",
      isAi: !!team?.is_ai,
      points: (row as any).points ?? 0,
      wins: (row as any).wins ?? 0,
      draws: (row as any).draws ?? 0,
      losses: (row as any).losses ?? 0,
      gf: (row as any).goals_for ?? 0,
      ga: (row as any).goals_against ?? 0,
    });
    standingsByLeague.set(lid, arr);
  }

  const leagueList = (leagues ?? []).map((l: any) => {
    const standings = (standingsByLeague.get(l.id) ?? []).sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));
    const human = standings.filter((s) => !s.isAi).length;
    const ai = standings.filter((s) => s.isAi).length;
    return {
      id: l.id, name: l.name, status: l.status, season: l.season_number,
      inviteCode: l.invite_code, createdAt: l.created_at,
      creator: usernameById.get(l.creator_id) ?? "—",
      teamCount: standings.length, humanCount: human, aiCount: ai,
      matchTotal: matchTotalByLeague.get(l.id) ?? 0,
      matchDone: matchDoneByLeague.get(l.id) ?? 0,
      standings,
    };
  });

  const totals = {
    users: (gameUsers ?? []).length,
    teams: (teams ?? []).length,
    humanTeams: (teams ?? []).filter((t: any) => !t.is_ai).length,
    aiTeams: (teams ?? []).filter((t: any) => t.is_ai).length,
    players: await count(svc, "players"),
    transfers: await count(svc, "transfers"),
    leagues: (leagues ?? []).length,
    activeLeagues: (leagues ?? []).filter((l: any) => l.status === "active").length,
  };

  return NextResponse.json({ leagues: leagueList, totals });
}

// DELETE — ligi güvenli sil (ad doğrulamalı, sadece admin)
export async function DELETE(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const svc = g.svc;

  let body: { leagueId?: string; confirmName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  if (!body.leagueId) return NextResponse.json({ error: "leagueId gerekli." }, { status: 400 });

  const { data: league } = await svc.from("leagues").select("id, name").eq("id", body.leagueId).maybeSingle();
  if (!league) return NextResponse.json({ error: "Lig bulunamadı." }, { status: 404 });

  if ((body.confirmName ?? "").trim() !== league.name) {
    return NextResponse.json({ error: "Onay için lig adını birebir yazmalısın." }, { status: 400 });
  }

  const res = await deleteLeagueCascade(svc, body.leagueId);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 500 });

  return NextResponse.json({ ok: true, ...res });
}
