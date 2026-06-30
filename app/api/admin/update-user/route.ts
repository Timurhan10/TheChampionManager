import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Bir kullanıcının CR/CMP/kullanıcı adını düzenler (sadece admin).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  if (!(await isAdmin(svc, user.id))) {
    return NextResponse.json({ error: "Yetkisiz (admin değil)." }, { status: 403 });
  }

  let body: { userId: string; credits?: number; cmp?: number; username?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  if (!body.userId) return NextResponse.json({ error: "userId gerekli." }, { status: 400 });

  const patch: Record<string, any> = {};
  if (body.credits !== undefined) {
    const c = Math.floor(Number(body.credits));
    if (isNaN(c) || c < 0) return NextResponse.json({ error: "Geçersiz CR." }, { status: 400 });
    patch.credits = c;
  }
  if (body.cmp !== undefined) {
    const c = Math.floor(Number(body.cmp));
    if (isNaN(c) || c < 0) return NextResponse.json({ error: "Geçersiz CMP." }, { status: 400 });
    patch.cmp_points = c;
  }
  if (body.username !== undefined) {
    const u = body.username.trim();
    if (!u) return NextResponse.json({ error: "Kullanıcı adı boş olamaz." }, { status: 400 });
    patch.username = u.slice(0, 50);
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Değişiklik yok." }, { status: 400 });

  const { error } = await svc.from("users").update(patch).eq("id", body.userId);
  if (error) {
    const msg = error.code === "23505" ? "Bu kullanıcı adı alınmış." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
