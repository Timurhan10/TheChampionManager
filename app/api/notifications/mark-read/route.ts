import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Kullanıcının bildirimlerini okundu işaretler (RLS kendi satırlarıyla sınırlar).
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
