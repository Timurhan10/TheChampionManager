/**
 * CMP mağaza ürünlerini seed eder.
 * Çalıştırma: SUPABASE env'leri ayarlıyken `npx tsx scripts/seed-cmp-shop.ts`
 * (Alternatif olarak supabase/migrations/0003_cmp_and_notifications.sql kullanılabilir.)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ShopItemSeed {
  name: string;
  description: string;
  tier: string;
  cmp_cost: number;
  item_type: string;
  item_data: Record<string, unknown>;
}

const ITEMS: ShopItemSeed[] = [
  { name: "Ekstra Scout Görevi", description: "Scout seviyeni 1 kademe yükseltir.", tier: "bronze", cmp_cost: 100, item_type: "scout_boost", item_data: {} },
  { name: "5.000 CR Bonus", description: "Kasana anında 5.000 CR ekler.", tier: "bronze", cmp_cost: 200, item_type: "cr_bonus", item_data: { amount: 5000 } },
  { name: "Scout Hız Bonusu", description: "Scout seviyeni 1 kademe yükseltir.", tier: "bronze", cmp_cost: 500, item_type: "scout_boost", item_data: {} },
  { name: "Garantili Genç Yetenek", description: "Yüksek potansiyelli bir genç oyuncu (16-19 yaş).", tier: "silver", cmp_cost: 1000, item_type: "youth_player", item_data: {} },
  { name: "20.000 CR Bonus", description: "Kasana anında 20.000 CR ekler.", tier: "silver", cmp_cost: 2000, item_type: "cr_bonus", item_data: { amount: 20000 } },
  { name: "Nadir Deneyimli Oyuncu", description: "Tecrübeli bir veteran (31-34 yaş, güçlü).", tier: "silver", cmp_cost: 3000, item_type: "veteran_player", item_data: {} },
  { name: "Stat Görünür Elite", description: "Elit seviye bir oyuncu, tüm statları görünür.", tier: "silver", cmp_cost: 5000, item_type: "elite_player", item_data: {} },
  { name: "Alt Yapı Süperstar", description: "Çok yüksek potansiyelli genç süperstar.", tier: "gold", cmp_cost: 10000, item_type: "youth_player", item_data: { superstar: true } },
  { name: "Takım Antrenman Bonusu", description: "Tüm kadronun rastgele özelliklerini geliştirir.", tier: "gold", cmp_cost: 15000, item_type: "training_bonus", item_data: {} },
  { name: "Efsanevi Oyuncu", description: "Neredeyse maksimum statlara sahip efsane.", tier: "gold", cmp_cost: 25000, item_type: "legendary_player", item_data: {} },
];

async function main() {
  const supabase = createClient(url, key);
  for (const item of ITEMS) {
    const { error } = await supabase.from("cmp_shop_items").insert(item);
    if (error) console.error(`Hata (${item.name}):`, error.message);
    else console.log(`✓ ${item.name}`);
  }
  console.log("CMP mağaza seed tamamlandı.");
}

main();
