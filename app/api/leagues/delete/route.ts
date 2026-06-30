import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { deleteLeagueCascade } from "@/lib/league-delete";

// Ligi GÜVENLİ siler. Yalnızca ligin KURUCUSU veya admin yapabilir.
// Lig adı birebir yazılarak onaylanır (yanlış silme önlenir).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { leagueId?: string; confirmName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  if (!body.leagueId) return NextResponse.json({ error: "leagueId gerekli." }, { status: 400 });

  const svc = createServiceClient();
  const { data: league } = await svc.from("leagues").select("id, name, creator_id").eq("id", body.leagueId).maybeSingle();
  if (!league) return NextResponse.json({ error: "Lig bulunamadı." }, { status: 404 });

  const isCreator = league.creator_id === user.id;
  if (!isCreator && !(await isAdmin(svc, user.id))) {
    return NextResponse.json({ error: "Bu ligi yalnızca kurucusu veya admin silebilir." }, { status: 403 });
  }

  if ((body.confirmName ?? "").trim() !== league.name) {
    return NextResponse.json({ error: "Onay için lig adını birebir yazmalısın." }, { status: 400 });
  }

  const res = await deleteLeagueCascade(svc, body.leagueId);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 500 });

  return NextResponse.json({ ok: true, ...res });
}
