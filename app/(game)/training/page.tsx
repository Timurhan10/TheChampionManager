import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import TrainingClient from "@/components/TrainingClient";
import type { Player } from "@/types/game";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const svc = createServiceClient();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const [{ data: players }, { data: teamRow }, { data: todays }] = await Promise.all([
    svc.from("players").select("id, name, position, age, potential").eq("team_id", team.id).order("position"),
    svc.from("teams").select("training_facility_level").eq("id", team.id).maybeSingle(),
    svc.from("training_sessions").select("player_id").eq("team_id", team.id).gte("created_at", dayStart.toISOString()),
  ]);

  const trainedToday = Array.from(new Set((todays ?? []).map((t: any) => t.player_id)));
  const remaining = Math.max(0, 3 - (todays ?? []).length);

  return (
    <>
      <PageTopBar title="Antrenman" subtitle={`Günlük hak: ${remaining}/3 · Oyuncu geliştir`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <TrainingClient
          players={(players ?? []) as Pick<Player, "id" | "name" | "position" | "age" | "potential">[]}
          trainedToday={trainedToday}
          remaining={remaining}
          facilityLevel={(teamRow as any)?.training_facility_level ?? 1}
        />
      </div>
    </>
  );
}
