import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import TacticsBoard from "@/components/TacticsBoard";
import PlayerCompare, { type ComparePlayer } from "@/components/PlayerCompare";
import { averageRating } from "@/lib/player-generator";
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

  const list = (players ?? []) as Player[];
  const comparePlayers: ComparePlayer[] = list.map((p) => ({
    id: p.id, name: p.name, position: p.position, age: p.age, value_cr: p.value_cr,
    overall: averageRating(p), potential: p.potential ?? null, attrs: p as any,
  }));

  return (
    <>
      <PageTopBar title="Taktik Kurulum" subtitle="Diziliş & ayarlar — otomatik kaydedilir" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <TacticsBoard players={list} initial={(tactics as Tactics) ?? null} />

        {comparePlayers.length >= 2 && (
          <div className="mt-8 pt-5 border-t border-border-cm max-w-2xl">
            <h3 className="font-display font-extrabold text-lg mb-1 flex items-center gap-2">
              <span className="text-emerald">⇄</span> Oyuncu Karşılaştırma
            </h3>
            <p className="text-xs text-text-muted mb-3">İki oyuncunu seç, özelliklerini yan yana karşılaştır.</p>
            <PlayerCompare players={comparePlayers} title="Karşılaştırma" />
          </div>
        )}
      </div>
    </>
  );
}
