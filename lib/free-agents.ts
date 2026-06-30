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
