import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import { getTeamEditability } from "@/lib/team-guard";
import PageTopBar from "@/components/PageTopBar";
import FriendlyMatch from "@/components/FriendlyMatch";

export default async function FriendliesPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const svc = createServiceClient();
  const { inActiveLeague } = await getTeamEditability(svc, team.id);

  return (
    <>
      <PageTopBar title="Hazırlık Maçları" subtitle="Lig başlamadan taktiklerini dene — sonuçlar kaydedilmez" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <FriendlyMatch canPlay={!inActiveLeague} />
      </div>
    </>
  );
}
