import { notFound, redirect } from "next/navigation";
import { getGameContext, getRevealedKeys } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import PageTopBar from "@/components/PageTopBar";
import AttributeBar from "@/components/AttributeBar";
import PlayerActions from "@/components/PlayerActions";
import BackButton from "@/components/BackButton";
import { overallRating } from "@/lib/player-generator";
import { computeBuyPrice } from "@/lib/pricing";
import {
  CATEGORY_ATTRS,
  CATEGORY_LABELS,
  ATTR_LABELS,
  POSITION_COLORS,
  POSITION_LABELS,
  ratingColor,
  defaultVisibleAttrs,
  ALL_OUTFIELD_ATTRS,
  GOALKEEPING_ATTRS,
  type AttributeCategory,
  type AttributeKey,
} from "@/lib/attributes";
import { formatCR } from "@/lib/utils";
import type { Player } from "@/types/game";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const { team } = await getGameContext();
  if (!team) redirect("/onboarding");

  const supabase = createClient();
  const { data } = await supabase.from("players").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();

  const player = data as Player;
  const isOwn = player.team_id === team.id;

  // Scouting ile açılan + varsayılan görünür attribute'lar (kendi oyuncusu değilse)
  let revealedSet: Set<string> | null = null; // null = hepsi açık
  if (!isOwn) {
    const map = await getRevealedKeys(supabase, team.id, [player.id]);
    const set = map.get(player.id) ?? new Set<string>();
    for (const k of defaultVisibleAttrs(player.position)) set.add(k); // birkaç özellik baştan görünür
    revealedSet = set;
  }

  const relevantAttrs: AttributeKey[] = player.position === "GK"
    ? [...ALL_OUTFIELD_ATTRS, ...GOALKEEPING_ATTRS]
    : [...ALL_OUTFIELD_ATTRS];
  const revealedCount = revealedSet ? revealedSet.size : relevantAttrs.length;
  const fullyKnown = isOwn || revealedCount >= relevantAttrs.length;
  const anyScouted = isOwn || revealedCount > 0;

  const rating = overallRating(player, player.position);
  const posColor = POSITION_COLORS[player.position];

  // Hangi kategoriler gösterilir? Kaleci paneli yalnızca GK'da.
  const categories: AttributeCategory[] = player.position === "GK"
    ? ["technical", "mental", "physical", "goalkeeping"]
    : ["technical", "mental", "physical"];

  return (
    <>
      <PageTopBar title={player.name} subtitle={POSITION_LABELS[player.position]} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <BackButton label="Geri" fallback="/team" />
        {/* Kimlik başlığı */}
        <div className="bg-gradient-to-r from-panel to-panel-inset border border-border-cm rounded-card p-6 mb-5 shadow-card flex items-center gap-5">
          <div className="w-[74px] h-[74px] rounded-xl flex items-center justify-center font-display font-extrabold text-2xl"
            style={{ background: posColor.bg, color: posColor.color }}>
            {player.position}
          </div>
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-3xl">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-pill" style={{ background: posColor.bg, color: posColor.color }}>
                {POSITION_LABELS[player.position].toUpperCase()}
              </span>
              <span className="text-sm text-text-muted">
                {player.age} yaşında {player.is_youth_academy && "· Alt Yapı"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="section-label mb-1">Ort. Rating</div>
            <div className="font-display font-extrabold text-4xl" style={{ color: fullyKnown ? ratingColor(rating) : "#475A73" }}>
              {fullyKnown ? rating : "?"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_268px] gap-4">
          {/* Attribute panelleri */}
          {categories.filter((cat) => cat !== "goalkeeping" || player.position === "GK").slice(0, 3).map((cat) => (
            <AttributePanel key={cat} category={cat} player={player} revealedKeys={revealedSet} />
          ))}

          {/* Sağ panel */}
          <div className="space-y-4">
            <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
              <div className="section-label mb-1">Piyasa Değeri</div>
              <div className="font-display font-extrabold text-3xl text-emerald">
                {anyScouted ? formatCR(player.value_cr) : "? CR"}
              </div>
            </div>
            <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
              <div className="section-label mb-2">Potansiyel</div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = fullyKnown && player.potential != null && i < Math.round(player.potential / 4);
                  return (
                    <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill={filled ? "#F59E0B" : "none"} stroke={filled ? "#F59E0B" : "#475A73"} strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  );
                })}
              </div>
              {!isOwn && (
                <p className="text-xs text-text-faint mt-2">
                  Scout durumu: {revealedCount}/{relevantAttrs.length} özellik
                </p>
              )}
            </div>

            <PlayerActions
              playerId={player.id}
              isOwn={isOwn}
              forSale={player.for_sale}
              askingPrice={player.team_id == null ? (player.asking_price ?? computeBuyPrice(player)) : player.asking_price}
              valueCr={player.value_cr}
              sellerTeamId={player.team_id}
              isFreeAgent={player.team_id == null}
              isYouth={player.is_youth_academy}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function AttributePanel({
  category,
  player,
  revealedKeys,
}: {
  category: AttributeCategory;
  player: Player;
  revealedKeys: Set<string> | null; // null = hepsi açık
}) {
  return (
    <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
      <div className="section-label mb-3">{CATEGORY_LABELS[category]}</div>
      <div>
        {CATEGORY_ATTRS[category].map((key) => {
          const hidden = revealedKeys !== null && !revealedKeys.has(key);
          return (
            <AttributeBar
              key={key}
              label={ATTR_LABELS[key]}
              value={(player[key] as number | null) ?? null}
              hidden={hidden}
            />
          );
        })}
      </div>
    </div>
  );
}
