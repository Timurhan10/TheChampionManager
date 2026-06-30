import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import TacticsBoard from "@/components/TacticsBoard";
import type { Player, Tactics } from "@/types/game";

export default async function TacticsPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  // RLS'den bağımsız güvenilir okuma (kendi takım verisi)
  const supabase = createServiceClient();
  const [{ data: players }, { data: tactics }] = await Promise.all([
    supabase.from("players").select("*").eq("team_id", team.id).order("position"),
    supabase.from("tactics").select("*").eq("team_id", team.id).maybeSingle(),
  ]);

  return (
    <>
      <PageTopBar title="Taktik Kurulum" subtitle="Diziliş & ayarlar — otomatik kaydedilir" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <TacticsBoard players={(players ?? []) as Player[]} initial={(tactics as Tactics) ?? null} />
      </div>
    </>
  );
}
