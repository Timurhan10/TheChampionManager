import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rotateFreeAgents } from "@/lib/free-agents";

// Transfer pazarını 12 saatte bir tembel (lazy) yeniler. Pazar sayfası ziyaret
// edildiğinde tetiklenir; 12s geçmediyse iş yapmaz (gate). Günlük cron da çağırır.
export async function GET(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  try {
    const svc = createServiceClient();
    const res = await rotateFreeAgents(svc);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Yenileme başarısız." }, { status: 500 });
  }
}

export const POST = GET;
