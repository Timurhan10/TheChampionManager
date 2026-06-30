import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { SALE_PAID_MARK } from "@/lib/sales";

// GEÇMİŞ SATIŞ MUTABAKATI (sadece admin, idempotent):
// Eskiden bir insan takımından AI takıma satılıp da "ödendi" işareti TAŞIMAYAN
// satışları bulur, satıcıya offer_amount kadar CR ekler ve transferi işaretler
// (message=SALE_PAID_MARK) → tekrar çalıştırılırsa aynı satışı yeniden kredilemez.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  if (!(await isAdmin(svc, user.id))) {
    return NextResponse.json({ error: "Yetkisiz (admin değil)." }, { status: 403 });
  }

  // İnsan takımları (team_id → user_id) ve AI takım id'leri
  const { data: teams } = await svc.from("teams").select("id, user_id, is_ai");
  const humanUserByTeam = new Map<string, string>();
  const aiIds = new Set<string>();
  for (const t of teams ?? []) {
    if ((t as any).is_ai) aiIds.add((t as any).id);
    else if ((t as any).user_id) humanUserByTeam.set((t as any).id, (t as any).user_id);
  }

  // Kabul edilmiş, AI'ya yapılmış, henüz işaretlenmemiş satışlar
  const { data: rows, error } = await svc
    .from("transfers")
    .select("id, from_team_id, to_team_id, offer_amount, message, status")
    .eq("status", "accepted");
  if (error) return NextResponse.json({ error: "Transferler okunamadı." }, { status: 500 });

  const eligible = (rows ?? []).filter((r: any) =>
    r.message !== SALE_PAID_MARK &&
    r.from_team_id && humanUserByTeam.has(r.from_team_id) &&
    r.to_team_id && aiIds.has(r.to_team_id) &&
    Number(r.offer_amount) > 0
  );

  // Kullanıcı bazında topla
  const byUser = new Map<string, number>();
  for (const r of eligible) {
    const uid = humanUserByTeam.get((r as any).from_team_id)!;
    byUser.set(uid, (byUser.get(uid) ?? 0) + Number((r as any).offer_amount));
  }

  let usersCredited = 0;
  let totalCr = 0;
  for (const [uid, amount] of Array.from(byUser.entries())) {
    const { data: u } = await svc.from("users").select("credits").eq("id", uid).maybeSingle();
    if (!u) continue;
    const { error: payErr } = await svc.from("users").update({ credits: u.credits + amount }).eq("id", uid);
    if (payErr) continue;
    usersCredited++;
    totalCr += amount;
  }

  // İşaretle (tekrar kredilenmesin)
  const ids = eligible.map((r: any) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    await svc.from("transfers").update({ message: SALE_PAID_MARK }).in("id", ids.slice(i, i + 200));
  }

  return NextResponse.json({ ok: true, salesReconciled: eligible.length, usersCredited, totalCr });
}
