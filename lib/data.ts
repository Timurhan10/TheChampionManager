import { createClient } from "@/lib/supabase/server";
import type { GameUser, Team } from "@/types/game";

// Geçerli oturum kullanıcısının oyun verisini (users satırı + takımı) getirir.
export async function getGameContext(): Promise<{
  authId: string | null;
  gameUser: GameUser | null;
  team: Team | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authId: null, gameUser: null, team: null };

  const { data: gameUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    authId: user.id,
    gameUser: (gameUser as GameUser) ?? null,
    team: (team as Team) ?? null,
  };
}
