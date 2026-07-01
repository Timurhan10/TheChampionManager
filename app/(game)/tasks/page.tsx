import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import TasksClient from "@/components/TasksClient";
import { DAILY_TASKS, computeTaskProgress, getClaimedToday } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const svc = createServiceClient();
  const [progress, claimed] = await Promise.all([
    computeTaskProgress(svc, team.id),
    getClaimedToday(svc, team.id),
  ]);

  const tasks = DAILY_TASKS.map((t) => ({
    ...t,
    progress: Math.min(t.target, progress[t.key] ?? 0),
    claimed: claimed.has(t.key),
  }));

  const doneCount = tasks.filter((t) => t.progress >= t.target).length;

  return (
    <>
      <PageTopBar title="Günlük Görevler" subtitle={`${doneCount}/${tasks.length} tamamlandı · Her gün 03:00'te (TR) yenilenir`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <TasksClient tasks={tasks} />
      </div>
    </>
  );
}
