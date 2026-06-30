import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { topUpFreeAgents } from "@/lib/free-agents";

// Serbest oyuncu havuzunu hedefe tamamlar (idempotent). Boş pazarı doldurmak için.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  try {
    const added = await topUpFreeAgents(svc);
    return NextResponse.json({ ok: true, added });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
