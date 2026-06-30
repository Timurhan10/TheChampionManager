// Serbest oyuncu (takımsız) havuzu yönetimi. Idempotent: hedef sayıya tamamlar,
// sınırsız büyümez. Kalite katmanlı üretim (Model A) — çoğu vasat, yıldız nadir.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePlayer, rollQualityTier } from "./player-generator";
import type { Position } from "@/types/game";

const FREE_AGENT_TARGET = 40;

function weightedPosition(): Position {
  const r = Math.random();
  if (r < 0.1) return "GK";
  if (r < 0.4) return "DF";
  if (r < 0.75) return "MF";
  return "FW";
}

// Serbest ajan sayısını hedefe tamamlar. Eklenen sayıyı döner.
export async function topUpFreeAgents(svc: SupabaseClient, target = FREE_AGENT_TARGET): Promise<number> {
  const { count } = await svc
    .from("players")
    .select("id", { count: "exact", head: true })
    .is("team_id", null);

  const need = Math.max(0, target - (count ?? 0));
  if (need === 0) return 0;

  const rows = Array.from({ length: need }).map(() => {
    const position = weightedPosition();
    const tier = rollQualityTier();
    const gen = generatePlayer({ position, tier, age: 18 + Math.floor(Math.random() * 17) }); // 18-34
    return {
      team_id: null,
      name: gen.name,
      age: gen.age,
      position,
      is_youth_academy: false,
      potential: gen.potential,
      value_cr: gen.value_cr,
      ...gen.attributes,
    };
  });

  const { error } = await svc.from("players").insert(rows);
  if (error) throw new Error(error.message);
  return need;
}

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 saat
const ROTATE_BATCH = 10;

// Pazarı 12 saatte bir rotasyona sokar: en eski "boşta" serbest ajanları silip
// yerine yenilerini ekler. Havuz ~target'ta sınırlı kalır, liste sürekli değişir.
// Sadece takımsız + satışta olmayan + scout raporu olmayan + bekleyen teklifi
// olmayan serbest ajanlara dokunur; kullanıcı/AI oyuncuları asla silinmez.
export async function rotateFreeAgents(
  svc: SupabaseClient,
  target = FREE_AGENT_TARGET,
): Promise<{ skipped: boolean; removed: number; added: number }> {
  // 12s gate: en yeni serbest ajan yakın zamanda eklendiyse iş yapma.
  const { data: newest } = await svc
    .from("players")
    .select("created_at")
    .is("team_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (newest?.created_at && Date.now() - new Date(newest.created_at).getTime() < REFRESH_INTERVAL_MS) {
    return { skipped: true, removed: 0, added: 0 };
  }

  // Silinmeye uygun en eski serbest ajanlar (satışta olmayanlar).
  const { data: candidates } = await svc
    .from("players")
    .select("id")
    .is("team_id", null)
    .eq("for_sale", false)
    .order("created_at", { ascending: true })
    .limit(ROTATE_BATCH * 3);

  let removed = 0;
  const candidateIds = (candidates ?? []).map((p: any) => p.id);
  if (candidateIds.length) {
    // Scout raporu veya bekleyen teklifi olan oyuncuları koru.
    const [{ data: scouted }, { data: pending }] = await Promise.all([
      svc.from("scouting_reports").select("target_player_id").in("target_player_id", candidateIds),
      svc.from("transfers").select("player_id").eq("status", "pending").in("player_id", candidateIds),
    ]);
    const protectedIds = new Set<string>([
      ...(scouted ?? []).map((r: any) => r.target_player_id),
      ...(pending ?? []).map((r: any) => r.player_id),
    ]);
    const removable = candidateIds.filter((id) => !protectedIds.has(id)).slice(0, ROTATE_BATCH);
    if (removable.length) {
      const { error } = await svc.from("players").delete().in("id", removable).is("team_id", null).eq("for_sale", false);
      if (!error) removed = removable.length;
    }
  }

  // Hedefe tamamla (yeni oyuncular ekler).
  const added = await topUpFreeAgents(svc, target);
  return { skipped: false, removed, added };
}

// Bir AI takımının 2-3 oyuncusunu satışa çıkarır.
export async function listAiPlayersForSale(svc: SupabaseClient, teamId: string): Promise<void> {
  const { data: players } = await svc.from("players").select("id, value_cr").eq("team_id", teamId);
  if (!players || players.length === 0) return;
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 2); // 2-3
  for (const p of shuffled.slice(0, count)) {
    await svc.from("players").update({ for_sale: true, asking_price: (p as any).value_cr }).eq("id", (p as any).id);
  }
}
