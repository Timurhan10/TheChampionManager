import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { processSales } from "@/lib/sales";

// Manuel/anlık tetikleme (cron veya giriş yapmış kullanıcı). Günlük cron /api/cron/daily içinde de çalışır.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  let authorized = secret ? auth === `Bearer ${secret}` : true;
  if (!authorized) {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    authorized = !!user;
  }
  if (!authorized) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  const res = await processSales(svc);
  return NextResponse.json({ ok: true, ...res });
}

export const POST = GET;
