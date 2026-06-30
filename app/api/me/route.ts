import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Giriş yapmış kullanıcının güncel bakiyesi (CR/CMP). TopBar bunu client'ta çekip
// skeleton gösterir; navigasyonlarda taze kalır.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ credits: null, cmp: null }, { status: 200 });

  const { data } = await supabase
    .from("users")
    .select("credits, cmp_points")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    credits: data?.credits ?? null,
    cmp: data?.cmp_points ?? null,
  });
}
