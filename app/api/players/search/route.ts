import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// İsme göre oyuncu arama (kendi takımı hariç). Scouting hedefi seçimi için.
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  const { data: team } = await supabase.from("teams").select("id").eq("user_id", user.id).maybeSingle();

  let query = supabase.from("players").select("id, name, age, position, team_id").limit(20);
  if (q) query = query.ilike("name", `%${q}%`);
  if (team) query = query.neq("team_id", team.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ players: data ?? [] });
}
