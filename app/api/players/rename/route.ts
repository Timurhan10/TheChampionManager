import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Oyuncunun adını ve/veya forma numarasını düzenler.
// Kozmetik düzenleme her zaman serbesttir (lig/transfer durumundan bağımsız);
// yalnızca kendi takımının oyuncusu düzenlenebilir.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: { playerId?: string; name?: string | null; shirtNumber?: number | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }

  if (!body.playerId) return NextResponse.json({ error: "Oyuncu belirtilmedi." }, { status: 400 });

  const update: { name?: string; shirt_number?: number | null } = {};

  // İsim (opsiyonel)
  if (body.name !== undefined) {
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "İsim boş olamaz." }, { status: 400 });
    update.name = name.slice(0, 100);
  }

  // Forma numarası (opsiyonel; null = temizle)
  let shirtNumber: number | null | undefined = undefined;
  if (body.shirtNumber !== undefined) {
    if (body.shirtNumber === null || (body.shirtNumber as unknown) === "") {
      shirtNumber = null;
    } else {
      const n = Number(body.shirtNumber);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        return NextResponse.json({ error: "Forma numarası 1 ile 99 arasında olmalı." }, { status: 400 });
      }
      shirtNumber = n;
    }
    update.shirt_number = shirtNumber;
  }

  if (update.name === undefined && update.shirt_number === undefined) {
    return NextResponse.json({ error: "Değiştirilecek bir bilgi yok." }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: team } = await svc.from("teams").select("id").eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 400 });

  const { data: player } = await svc.from("players").select("id, team_id").eq("id", body.playerId).maybeSingle();
  if (!player || player.team_id !== team.id) return NextResponse.json({ error: "Bu oyuncu sana ait değil." }, { status: 403 });

  // Forma numarası takım içinde benzersiz olmalı (null hariç).
  if (shirtNumber != null) {
    const { data: clash } = await svc
      .from("players")
      .select("id")
      .eq("team_id", team.id)
      .eq("shirt_number", shirtNumber)
      .neq("id", player.id)
      .maybeSingle();
    if (clash) return NextResponse.json({ error: `${shirtNumber} numarası takımında başka bir oyuncuda.` }, { status: 400 });
  }

  const { error } = await svc.from("players").update(update).eq("id", player.id);
  if (error) return NextResponse.json({ error: "Kaydedilemedi, tekrar dene." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
