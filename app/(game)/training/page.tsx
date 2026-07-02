import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import TrainingClient from "@/components/TrainingClient";
import { overallRating } from "@/lib/player-generator";
import { DAILY_TRAINING_LIMIT } from "@/lib/training";
import { utcDayStart } from "@/lib/utils";
import type { Player } from "@/types/game";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { team, gameUser } = await getGameContext();
  if (!team) redirect("/onboarding");

  const svc = createServiceClient();
  const [{ data: players }, { data: teamRow }, { data: todays }] = await Promise.all([
    svc.from("players").select("*").eq("team_id", team.id).order("position"),
    svc.from("teams").select("training_facility_level").eq("id", team.id).maybeSingle(),
    svc.from("training_sessions").select("player_id").eq("team_id", team.id).gte("created_at", utcDayStart().toISOString()),
  ]);

  const trainedToday = Array.from(new Set((todays ?? []).map((t: any) => t.player_id)));
  const remaining = Math.max(0, DAILY_TRAINING_LIMIT - (todays ?? []).length);

  // Mentor UI için genel puan sunucuda hesaplanır (attribute'lar istemciye gitmez).
  const roster = ((players ?? []) as Player[]).map((p) => ({
    id: p.id, name: p.name, position: p.position, age: p.age, potential: p.potential ?? null,
    overall: overallRating(p, p.position),
    mentorId: (p as any).mentor_id ?? null,
  }));

  return (
    <>
      <PageTopBar title="Antrenman" subtitle={`Günlük hak: ${remaining}/${DAILY_TRAINING_LIMIT} · Oyuncu geliştir`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <TrainingClient
          players={roster}
          trainedToday={trainedToday}
          remaining={remaining}
          facilityLevel={(teamRow as any)?.training_facility_level ?? 1}
          credits={gameUser?.credits ?? 0}
        />
      </div>
    </>
  );
}
