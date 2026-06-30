import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Tüm kullanıcıları listeler (sadece admin). E-posta + oyun verisi + takım.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  if (!(await isAdmin(svc, user.id))) {
    return NextResponse.json({ error: "Yetkisiz (admin değil)." }, { status: 403 });
  }

  // Auth e-postaları
  const { data: authData } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map((authData?.users ?? []).map((u: any) => [u.id, u.email]));

  // Oyun verisi + takımlar (paralel)
  const [{ data: gameUsers }, { data: teams }] = await Promise.all([
    svc.from("users").select("id, username, credits, cmp_points, is_admin, created_at"),
    svc.from("teams").select("user_id, name"),
  ]);
  const teamByUser = new Map((teams ?? []).map((t: any) => [t.user_id, t.name]));

  const rows = (gameUsers ?? []).map((u: any) => ({
    id: u.id,
    email: emailById.get(u.id) ?? "—",
    username: u.username,
    credits: u.credits,
    cmp: u.cmp_points,
    isAdmin: u.is_admin === true,
    team: teamByUser.get(u.id) ?? null,
    createdAt: u.created_at,
  }));

  // Auth'ta olup users tablosunda olmayanlar (onboarding tamamlamamış)
  for (const au of authData?.users ?? []) {
    if (!rows.find((r) => r.id === au.id)) {
      rows.push({ id: au.id, email: au.email ?? "—", username: "(kayıt tamamlanmadı)", credits: 0, cmp: 0, isAdmin: false, team: null, createdAt: au.created_at });
    }
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ users: rows });
}
