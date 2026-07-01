import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { LineupPreset } from "@/types/game";

const MAX_PRESETS = 3;

// İlk 11 / taktik kayıt slotları: kaydet (ekle/güncelle) veya sil.
// body: { action: "save" | "delete", index?: number, name?: string, preset?: LineupPreset }
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  // Mevcut taktik satırı (yoksa oluştur)
  const { data: row } = await svc.from("tactics").select("presets").eq("team_id", team.id).maybeSingle();
  let presets: LineupPreset[] = Array.isArray(row?.presets) ? (row!.presets as LineupPreset[]) : [];

  if (body.action === "save") {
    const p = body.preset;
    if (!p || typeof p !== "object") return NextResponse.json({ error: "Kayıt verisi eksik." }, { status: 400 });
    const name = String(body.name ?? p.name ?? "").trim().slice(0, 40) || `Kayıt ${presets.length + 1}`;
    const clean: LineupPreset = {
      name,
      formation: String(p.formation ?? "4-4-2"),
      mentality: String(p.mentality ?? "balanced"),
      pressing: String(p.pressing ?? "medium"),
      tempo: String(p.tempo ?? "normal"),
      pass_style: String(p.pass_style ?? "mixed"),
      lineup: (p.lineup && typeof p.lineup === "object") ? p.lineup : {},
      substitutes: Array.isArray(p.substitutes) ? p.substitutes : [],
      player_instructions: (p.player_instructions && typeof p.player_instructions === "object") ? p.player_instructions : {},
    };
    if (typeof body.index === "number" && body.index >= 0 && body.index < presets.length) {
      presets[body.index] = clean; // var olan slotu güncelle
    } else {
      if (presets.length >= MAX_PRESETS) {
        return NextResponse.json({ error: `En fazla ${MAX_PRESETS} kayıt tutabilirsin. Birini silip tekrar dene.` }, { status: 400 });
      }
      presets.push(clean);
    }
  } else if (body.action === "delete") {
    if (typeof body.index !== "number" || body.index < 0 || body.index >= presets.length) {
      return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 });
    }
    presets.splice(body.index, 1);
  } else {
    return NextResponse.json({ error: "Bilinmeyen işlem." }, { status: 400 });
  }

  const { error } = await svc.from("tactics").upsert(
    { team_id: team.id, presets, updated_at: new Date().toISOString() },
    { onConflict: "team_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidatePath("/first-eleven");
  revalidatePath("/tactics");
  return NextResponse.json({ ok: true, presets });
}
