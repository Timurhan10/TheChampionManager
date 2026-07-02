import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { taskByKey, computeTaskProgress, utcDayKey } from "@/lib/tasks";

// Günlük görev ödülünü talep eder. Koşul sunucuda yeniden hesaplanır;
// çift claim task_claims'teki unique(team_id, task_key, day) ile engellenir.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { taskKey: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const task = taskByKey(body.taskKey);
  if (!task) return NextResponse.json({ error: "Geçersiz görev." }, { status: 400 });

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  // Koşul doğrulaması — istemciden gelen ilerlemeye güvenilmez.
  const progress = await computeTaskProgress(svc, team.id);
  if ((progress[task.key] ?? 0) < task.target) {
    return NextResponse.json({ error: "Görev henüz tamamlanmadı." }, { status: 400 });
  }

  // Önce claim kaydı (unique çift claim'i engeller), sonra ödül.
  const { error: claimErr } = await svc.from("task_claims").insert({
    team_id: team.id, task_key: task.key, day: utcDayKey(),
  });
  if (claimErr) return NextResponse.json({ error: "Bu görevin ödülü bugün zaten alındı." }, { status: 409 });

  await svc.rpc("add_credits", { uid: user.id, delta: task.rewardCr });
  if (task.rewardCmp > 0) await svc.rpc("add_cmp", { uid: user.id, delta: task.rewardCmp });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, rewardCr: task.rewardCr, rewardCmp: task.rewardCmp });
}
