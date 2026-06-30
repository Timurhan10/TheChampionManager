import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getTeamEditability } from "@/lib/team-guard";

// Lig başlamadan + hiç transfer yapılmadan takımı güvenli siler.
// Para (users.credits/cmp) KORUNUR — geri ödeme yok, eksiye düşme yok.
// FK kısıtlarına uygun sıralı silme; oyuncular SET NULL ile serbest ajana DÖNÜŞMEZ (açıkça silinir).
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { inActiveLeague, hasTransfers, editable } = await getTeamEditability(svc, team.id);
  if (!editable) {
    const reason = inActiveLeague ? "Lig başladıktan sonra takım sıfırlanamaz." : "Transfer/satış yaptığın için takım sıfırlanamaz (veri/para bütünlüğü için).";
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  // Oyuncu id'leri
  const { data: players } = await svc.from("players").select("id").eq("team_id", team.id);
  const playerIds = (players ?? []).map((p: any) => p.id);

  // FK-güvenli sıralı silme
  if (playerIds.length) {
    await svc.from("scouting_reports").delete().in("target_player_id", playerIds);
  }
  await svc.from("scouting_reports").delete().eq("scout_team_id", team.id);
  await svc.from("tactics").delete().eq("team_id", team.id);
  await svc.from("youth_academy").delete().eq("team_id", team.id);
  await svc.from("league_teams").delete().eq("team_id", team.id);
  await svc.from("players").delete().eq("team_id", team.id); // açıkça sil (SET NULL olmasın)
  const { error: delErr } = await svc.from("teams").delete().eq("id", team.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // Para korunur — users satırına dokunulmaz.
  return NextResponse.json({ ok: true });
}
