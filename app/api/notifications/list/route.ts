import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAdminTeamIds } from "@/lib/admin";

// Bildirim dropdown verisi: kişisel bildirimler + herkese açık "piyasa hareketleri".
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ personal: [], market: [], unread: 0 });

  // Kişisel bildirimler (RLS kendi satırlarıyla sınırlar)
  const { data: personal } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  const unread = (personal ?? []).filter((n: any) => !n.is_read).length;

  // Piyasa hareketleri: tamamlanan transferler (admin takımları hariç)
  const svc = createServiceClient();
  const adminTeams = await getAdminTeamIds(svc);

  const { data: transfers } = await svc
    .from("transfers")
    .select("id, player_id, from_team_id, to_team_id, offer_amount, resolved_at")
    .eq("status", "accepted")
    .order("resolved_at", { ascending: false })
    .limit(25);

  const filtered = (transfers ?? []).filter(
    (t: any) => !adminTeams.includes(t.from_team_id) && !adminTeams.includes(t.to_team_id)
  );

  // İsimleri topla
  const playerIds = Array.from(new Set(filtered.map((t: any) => t.player_id).filter(Boolean)));
  const teamIds = Array.from(new Set(filtered.flatMap((t: any) => [t.from_team_id, t.to_team_id]).filter(Boolean)));
  const [{ data: players }, { data: teams }] = await Promise.all([
    playerIds.length ? svc.from("players").select("id, name").in("id", playerIds) : Promise.resolve({ data: [] as any[] }),
    teamIds.length ? svc.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const pName = new Map((players ?? []).map((p: any) => [p.id, p.name]));
  const tName = new Map((teams ?? []).map((t: any) => [t.id, t.name]));

  const market = filtered.slice(0, 15).map((t: any) => ({
    id: t.id,
    player: pName.get(t.player_id) ?? "Oyuncu",
    from: t.from_team_id ? (tName.get(t.from_team_id) ?? "—") : "Serbest",
    to: tName.get(t.to_team_id) ?? "—",
    amount: t.offer_amount,
    at: t.resolved_at,
  }));

  return NextResponse.json({ personal: personal ?? [], market, unread });
}
