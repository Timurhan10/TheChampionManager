// İnsan takımlarının satılık oyuncularını işler (otomatik satış).
// Para güvenliği: bir oyuncu YALNIZCA satıcı gerçekten ödendiyse satılmış kalır.
// Ödeme başarısız olursa satış geri alınır (oyuncu yeniden satışa döner) → para asla kaybolmaz.
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAutoSalePrice, sellProbability } from "./pricing";
import { notify } from "./notifications";

// transfers.message üzerinde "satıcıya ödendi" işareti. Geçmiş satış mutabakatı
// (admin) yalnızca bu işareti TAŞIMAYAN eski satışları kredilendirir → çift ödeme yok.
export const SALE_PAID_MARK = "seller_paid";

interface ClaimedSale {
  playerId: string;
  name: string;
  fromTeamId: string;
  prevAskingPrice: number | null;
  userId: string;
  buyer: string | null;
  price: number;
}

export async function processSales(svc: SupabaseClient): Promise<{ processed: number; sold: number; paid: number; reverted: number }> {
  // listed_at kolonu yoksa (migration 0007 öncesi) onsuz dene
  let listed: any[] | null = null;
  const full = await svc
    .from("players")
    .select("id, team_id, value_cr, matches_played, rating_sum, age, position, listed_at, asking_price, name, is_youth_academy, teams(user_id, is_ai)")
    .eq("for_sale", true);
  if (full.error) {
    const fb = await svc
      .from("players")
      .select("id, team_id, value_cr, matches_played, rating_sum, age, position, asking_price, name, is_youth_academy, teams(user_id, is_ai)")
      .eq("for_sale", true);
    if (fb.error) return { processed: 0, sold: 0, paid: 0, reverted: 0 };
    listed = fb.data;
  } else {
    listed = full.data;
  }

  const { data: aiTeams } = await svc.from("teams").select("id").eq("is_ai", true);
  const aiIds = (aiTeams ?? []).map((t: any) => t.id);
  const pickBuyer = () => (aiIds.length ? aiIds[Math.floor(Math.random() * aiIds.length)] : null);

  const now = Date.now();

  // 1) Aşama: satışları atomik olarak "talep et" (çift satış engeli), henüz ödeme yapma.
  const claimed: ClaimedSale[] = [];
  for (const p of listed ?? []) {
    const team = (p as any).teams;
    if (!team || team.is_ai || !team.user_id) continue; // sadece insan takımları

    // Alt yapı oyuncuları satılamaz; yanlışlıkla listelenmişse satıştan kaldır.
    if ((p as any).is_youth_academy) {
      await svc.from("players").update({ for_sale: false, asking_price: null }).eq("id", (p as any).id);
      continue;
    }

    const daysListed = (p as any).listed_at ? (now - new Date((p as any).listed_at).getTime()) / 86400000 : 99;
    const force = daysListed >= 2; // 3 gün garantisi
    if (!force && Math.random() >= sellProbability(p as any)) continue;

    const price = computeAutoSalePrice(p as any);
    const buyer = pickBuyer();

    // Atomik: yalnızca hâlâ satıştaysa. listed_at kolonu yoksa onsuz.
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
    if (!upd.data || upd.data.length === 0) continue; // başka süreç aldı

    claimed.push({
      playerId: (p as any).id,
      name: (p as any).name,
      fromTeamId: (p as any).team_id,
      prevAskingPrice: (p as any).asking_price ?? null,
      userId: team.user_id,
      buyer,
      price,
    });
  }

  // Talep edilen satışı geri al (ödeme yapılamadıysa) → oyuncu yeniden satışa döner, sonraki turda tekrar denenir.
  const revert = async (s: ClaimedSale) => {
    const back = { team_id: s.fromTeamId, for_sale: true, asking_price: s.prevAskingPrice };
    const r = await svc.from("players").update({ ...back, listed_at: null }).eq("id", s.playerId);
    if (r.error) await svc.from("players").update(back).eq("id", s.playerId);
  };

  // 2) Aşama: ödemeleri kullanıcı bazında topla, tek yazımda öde (intra-run yarış yok).
  const byUser = new Map<string, ClaimedSale[]>();
  for (const s of claimed) {
    const arr = byUser.get(s.userId) ?? [];
    arr.push(s);
    byUser.set(s.userId, arr);
  }

  const succeeded: ClaimedSale[] = [];
  let reverted = 0;

  for (const [userId, sales] of Array.from(byUser.entries())) {
    const total = sales.reduce((sum, s) => sum + s.price, 0);
    // Atomik artış (yarış durumu yok). Ödeme yapılamazsa satışları geri al.
    const { error: payErr } = await svc.rpc("add_credits", { uid: userId, delta: total });
    if (payErr) {
      for (const s of sales) { await revert(s); reverted++; }
      continue;
    }
    succeeded.push(...sales);
  }

  // 3) Aşama: ödenen satışlar için transfer kaydı + bildirim.
  for (const s of succeeded) {
    await svc.from("transfers").insert({
      player_id: s.playerId, from_team_id: s.fromTeamId, to_team_id: s.buyer,
      offer_amount: s.price, status: "accepted", resolved_at: new Date().toISOString(),
      message: SALE_PAID_MARK,
    });
    await notify(svc, s.userId, "transfer_result", `${s.name} satıldı`, `+${s.price.toLocaleString("tr-TR")} CR kasana eklendi.`);
  }

  return { processed: (listed ?? []).length, sold: succeeded.length, paid: succeeded.length, reverted };
}
