import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generatePlayer } from "@/lib/player-generator";
import { ALL_ATTRS } from "@/lib/attributes";
import { formatNumber } from "@/lib/utils";
import { notify } from "@/lib/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/types/game";

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];
function pickPos(): Position { return POSITIONS[Math.floor(Math.random() * POSITIONS.length)]; }

async function addPlayer(
  svc: SupabaseClient,
  teamId: string,
  opts: { age?: number; isYouth?: boolean; attrMin: number; attrMax: number; potential: number }
) {
  const gen = generatePlayer({ position: pickPos(), age: opts.age, isYouth: opts.isYouth, attrMin: opts.attrMin, attrMax: opts.attrMax });
  await svc.from("players").insert({
    team_id: teamId, name: gen.name, age: gen.age, position: gen.position,
    is_youth_academy: opts.isYouth ?? false, potential: opts.potential, value_cr: gen.value_cr,
    ...gen.attributes,
  });
  return gen.name;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { itemId: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id, scout_level").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: item } = await svc.from("cmp_shop_items").select("*").eq("id", body.itemId).eq("is_active", true).maybeSingle();
  if (!item) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  const { data: gameUser } = await svc.from("users").select("credits, cmp_points").eq("id", user.id).single();
  if (!gameUser || gameUser.cmp_points < item.cmp_cost) {
    return NextResponse.json({ error: "Yetersiz CMP." }, { status: 400 });
  }

  const data = item.item_data ?? {};
  let resultText = "";

  switch (item.item_type) {
    case "cr_bonus": {
      const amount = Number(data.amount ?? 0);
      await svc.rpc("add_credits", { uid: user.id, delta: amount });
      resultText = `${formatNumber(amount)} CR eklendi.`;
      break;
    }
    case "scout_boost": {
      const cur = team.scout_level ?? 1;
      if (cur >= 3) return NextResponse.json({ error: "Scout zaten maksimum seviyede." }, { status: 400 });
      await svc.from("teams").update({ scout_level: cur + 1 }).eq("id", team.id);
      resultText = `Scout seviyesi ${cur + 1} oldu.`;
      break;
    }
    case "youth_player": {
      const superstar = !!data.superstar;
      const name = await addPlayer(svc, team.id, { isYouth: true, attrMin: superstar ? 9 : 7, attrMax: superstar ? 13 : 11, potential: superstar ? 19 + Math.floor(Math.random() * 2) : 15 + Math.floor(Math.random() * 4) });
      resultText = `${name} alt yapına katıldı.`;
      break;
    }
    case "elite_player": {
      const name = await addPlayer(svc, team.id, { age: 24 + Math.floor(Math.random() * 6), attrMin: 15, attrMax: 18, potential: 17 + Math.floor(Math.random() * 3) });
      resultText = `Elite oyuncu ${name} takımına katıldı.`;
      break;
    }
    case "legendary_player": {
      const name = await addPlayer(svc, team.id, { age: 26 + Math.floor(Math.random() * 4), attrMin: 17, attrMax: 20, potential: 20 });
      resultText = `Efsane ${name} takımına katıldı!`;
      break;
    }
    case "veteran_player": {
      const name = await addPlayer(svc, team.id, { age: 31 + Math.floor(Math.random() * 4), attrMin: 14, attrMax: 17, potential: 12 });
      resultText = `Deneyimli ${name} takımına katıldı.`;
      break;
    }
    case "training_bonus": {
      const { data: players } = await svc.from("players").select("*").eq("team_id", team.id);
      for (const p of players ?? []) {
        const patch: Record<string, number> = {};
        const keys = ALL_ATTRS.filter((k) => typeof (p as any)[k] === "number").sort(() => Math.random() - 0.5).slice(0, 3);
        for (const k of keys) patch[k] = Math.min(20, ((p as any)[k] as number) + 1);
        if (Object.keys(patch).length) await svc.from("players").update(patch).eq("id", (p as any).id);
      }
      resultText = "Tüm kadron antrenman bonusu aldı.";
      break;
    }
    default:
      return NextResponse.json({ error: "Bilinmeyen ürün tipi." }, { status: 400 });
  }

  await svc.rpc("add_cmp", { uid: user.id, delta: -item.cmp_cost });
  await svc.from("cmp_purchases").insert({ user_id: user.id, item_id: item.id, cmp_spent: item.cmp_cost });
  await notify(svc, user.id, "cmp_purchase", `Satın alındı: ${item.name}`, resultText);

  return NextResponse.json({ ok: true, result: resultText });
}
