import { redirect } from "next/navigation";
import Link from "next/link";
import { getGameContext, getRevealedKeys } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import IncomingOffers, { type Offer } from "@/components/IncomingOffers";
import { averageRating } from "@/lib/player-generator";
import { POSITION_COLORS, ratingColor } from "@/lib/attributes";
import { formatNumber, teamBadge } from "@/lib/utils";
import type { Player } from "@/types/game";

export default async function TransferMarketPage() {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createClient();

  // Satıştaki oyuncular (başkalarının) + serbest ajanlar
  const [{ data: forSaleRows }, { data: freeAgents }, { data: myListings }] = await Promise.all([
    supabase.from("players").select("*").eq("for_sale", true).neq("team_id", team.id).limit(60),
    supabase.from("players").select("*").is("team_id", null).limit(40),
    supabase.from("players").select("*").eq("team_id", team.id).eq("for_sale", true),
  ]);

  const listed = [...(forSaleRows ?? []), ...(freeAgents ?? [])] as Player[];

  // Takım adları
  const teamIds = Array.from(new Set(listed.map((p) => p.team_id).filter(Boolean))) as string[];
  const { data: teamRows } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] as any[] };
  const teamNameById = new Map((teamRows ?? []).map((t: any) => [t.id, t.name]));

  // Scout durumu
  const revealed = await getRevealedKeys(supabase, team.id, listed.map((p) => p.id));

  // Gelen teklifler (kendi oyuncularıma)
  const { data: offerRows } = await supabase
    .from("transfers")
    .select("id, offer_amount, player_id, to_team_id")
    .eq("from_team_id", team.id)
    .eq("status", "pending");

  const offerPlayerIds = (offerRows ?? []).map((o: any) => o.player_id);
  const offerBuyerIds = (offerRows ?? []).map((o: any) => o.to_team_id);
  const { data: offerPlayers } = offerPlayerIds.length
    ? await supabase.from("players").select("id, name").in("id", offerPlayerIds)
    : { data: [] as any[] };
  const { data: buyerTeams } = offerBuyerIds.length
    ? await supabase.from("teams").select("id, name").in("id", offerBuyerIds)
    : { data: [] as any[] };
  const playerNameById = new Map((offerPlayers ?? []).map((p: any) => [p.id, p.name]));
  const buyerNameById = new Map((buyerTeams ?? []).map((t: any) => [t.id, t.name]));

  const offers: Offer[] = (offerRows ?? []).map((o: any) => ({
    id: o.id, amount: o.offer_amount,
    playerName: playerNameById.get(o.player_id) ?? "—",
    buyerName: buyerNameById.get(o.to_team_id) ?? "—",
  }));

  return (
    <>
      <PageTopBar title="Transfer Pazarı" subtitle={`${listed.length} oyuncu listede`} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <div className="grid grid-cols-[1fr_300px] gap-5">
          {/* Liste */}
          <div>
            <div className="section-label mb-2">Satıştaki Oyuncular & Serbest Ajanlar</div>
            <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
              <div className="grid grid-cols-[1.6fr_48px_1fr_90px_100px_84px] gap-2 px-4 py-2.5 border-b border-border-cm text-[10px] font-bold text-text-faint uppercase">
                <span>İsim</span><span>Yaş</span><span>Takım</span><span>Rating</span><span>Değer</span><span></span>
              </div>
              {listed.length === 0 && <div className="px-4 py-8 text-center text-text-muted text-sm">Şu an satışta oyuncu yok.</div>}
              {listed.map((p) => {
                const scouted = (revealed.get(p.id)?.size ?? 0) > 0;
                const free = p.team_id == null;
                const price = p.asking_price ?? p.value_cr;
                const rating = averageRating(p);
                return (
                  <div key={p.id} className="grid grid-cols-[1.6fr_48px_1fr_90px_100px_84px] gap-2 px-4 py-2.5 items-center border-b border-border-soft last:border-0 hover:bg-panel-inset/40">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[p.position].bg, color: POSITION_COLORS[p.position].color }}>{p.position}</span>
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {p.is_youth_academy && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-amber">ALT YAPI</span>}
                    </div>
                    <span className="text-sm text-text-2 num">{p.age}</span>
                    <span className={`text-xs truncate ${free ? "text-amber" : "text-text-2"}`}>{free ? "Serbest" : teamNameById.get(p.team_id) ?? "—"}</span>
                    <span className="font-display font-bold" style={{ color: scouted ? ratingColor(rating) : "#475A73" }}>{scouted ? rating : "?"}</span>
                    <span className="text-sm text-text-2">{formatNumber(price)} CR</span>
                    <Link href={`/player/${p.id}`} className="text-xs text-center border border-border-cm py-1 rounded hover:bg-panel-inset">
                      {free ? "İncele" : "Teklif"}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sağ panel */}
          <div className="space-y-5">
            <div>
              <div className="section-label mb-2">Satışa Çıkardıklarım ({myListings?.length ?? 0})</div>
              <div className="bg-panel border border-border-cm rounded-card p-3 space-y-2">
                {(myListings ?? []).length === 0 && <div className="text-text-muted text-sm py-2 text-center">Listede oyuncun yok.</div>}
                {(myListings as Player[] ?? []).map((p) => (
                  <Link key={p.id} href={`/player/${p.id}`} className="flex justify-between items-center bg-panel-inset rounded-lg px-3 py-2 hover:border-emerald border border-transparent">
                    <span className="text-sm flex items-center gap-2"><span className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[p.position].bg, color: POSITION_COLORS[p.position].color }}>{p.position}</span>{p.name}</span>
                    <span className="text-xs text-amber">{formatNumber(p.asking_price ?? 0)} CR</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="section-label mb-2">Gelen Teklifler ({offers.length})</div>
              <div className="bg-panel border border-border-cm rounded-card p-3">
                <IncomingOffers offers={offers} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
