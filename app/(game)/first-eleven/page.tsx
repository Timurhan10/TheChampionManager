import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import FirstElevenEditor from "@/components/FirstElevenEditor";
import type { Player, Tactics } from "@/types/game";

// Kaydetmeden sonra daima taze veri oku (eski diziliş görünme hatasını önler).
export const dynamic = "force-dynamic";

export default async function FirstElevenPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createServiceClient();
  const [{ data: players }, { data: tactics }] = await Promise.all([
    supabase.from("players").select("*").eq("team_id", team.id).order("position"),
    supabase.from("tactics").select("*").eq("team_id", team.id).maybeSingle(),
  ]);

  return (
    <>
      <PageTopBar title="İlk 11" subtitle="Dokun-yerleştir ile hızlı diziliş" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <FirstElevenEditor players={(players ?? []) as Player[]} initial={(tactics as Tactics) ?? null} />
      </div>
    </>
  );
}
