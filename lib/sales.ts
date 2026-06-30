// İnsan takımlarının satılık oyuncularını işler (otomatik satış).
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAutoSalePrice, sellProbability } from "./pricing";
import { notify } from "./notifications";

export async function processSales(svc: SupabaseClient): Promise<{ processed: number; sold: number }> {
  // listed_at kolonu yoksa (migration 0007 öncesi) onsuz dene
  let listed: any[] | null = null;
  const full = await svc
    .from("players")
    .select("id, team_id, value_cr, matches_played, rating_sum, age, position, listed_at, name, teams(user_id, is_ai)")
    .eq("for_sale", true);
  if (full.error) {
    const fb = await svc
      .from("players")
      .select("id, team_id, value_cr, matches_played, rating_sum, age, position, name, teams(user_id, is_ai)")
      .eq("for_sale", true);
    if (fb.error) return { processed: 0, sold: 0 };
    listed = fb.data;
  } else {
    listed = full.data;
  }

  const { data: aiTeams } = await svc.from("teams").select("id").eq("is_ai", true);
  const aiIds = (aiTeams ?? []).map((t: any) => t.id);
  const pickBuyer = () => (aiIds.length ? aiIds[Math.floor(Math.random() * aiIds.length)] : null);

  const now = Date.now();
  let sold = 0;

  for (const p of listed ?? []) {
    const team = (p as any).teams;
    if (!team || team.is_ai || !team.user_id) continue; // sadece insan takımları

    const daysListed = (p as any).listed_at ? (now - new Date((p as any).listed_at).getTime()) / 86400000 : 99;
    const force = daysListed >= 2; // 3 gün garantisi
    if (!force && Math.random() >= sellProbability(p as any)) continue;

    const price = computeAutoSalePrice(p as any);
    const buyer = pickBuyer();

    // Atomik: yalnızca hâlâ satıştaysa (çift satış engeli). listed_at kolonu yoksa onsuz.
    let upd = await svc
      .from("players")
      .update({ team_id: buyer, for_sale: false, asking_price: null, listed_at: null })
      .eq("id", (p as any).id)
      .eq("for_sale", true)
      .select("id");
    if (upd.error) {
      upd = await svc
        .from("players")
        .update({ team_id: buyer, for_sale: false, asking_price: null })
        .eq("id", (p as any).id)
        .eq("for_sale", true)
        .select("id");
    }
    if (!upd.data || upd.data.length === 0) continue;

    const { data: u } = await svc.from("users").select("credits").eq("id", team.user_id).single();
    if (u) await svc.from("users").update({ credits: u.credits + price }).eq("id", team.user_id);

    await svc.from("transfers").insert({
      player_id: (p as any).id, from_team_id: (p as any).team_id, to_team_id: buyer,
      offer_amount: price, status: "accepted", resolved_at: new Date().toISOString(),
    });
    await notify(svc, team.user_id, "transfer_result", `${(p as any).name} satıldı`, `+${price.toLocaleString("tr-TR")} CR kasana eklendi.`);
    sold++;
  }

  return { processed: (listed ?? []).length, sold };
}
