// Taktik-kadro uyumu (Motor v2'nin kalbi): seçilen stil/ayarlar kadroya ne kadar
// uyuyor? 0-100 puan + Türkçe eksik/güçlü yön açıklamaları. Saf fonksiyon —
// taktik sayfası (client), canlı motor ve anlık sim (server) aynı kodu kullanır.
import type { Player, Tactics, TacticStyle } from "@/types/game";
import type { AttributeKey } from "@/lib/attributes";
import { FORMATIONS } from "@/lib/formations";
import { startingEleven } from "./simulator";
import { STYLE_PRESETS } from "@/lib/tactic-styles";

export interface FitGap { text: string; severity: "low" | "high" }
export interface FitResult { score: number; gaps: FitGap[]; strengths: string[]; style: TacticStyle }

type Group = "GK" | "DF" | "MF" | "FW" | "wide" | "team";

interface Req {
  group: Group;
  attrs: AttributeKey[];
  weight: number;
  target?: number; // 1-20 skala; varsayılan 12
  gap: string;     // uyarı metni
  strong?: string; // güçlü yön metni (s>=0.75)
}

const REQUIREMENTS: Record<TacticStyle, Req[]> = {
  gegenpress: [
    { group: "team", attrs: ["work_rate", "stamina", "teamwork"], weight: 3, gap: "Kadro yüksek baskı için yeterince çalışkan/dayanıklı değil — oyuncular erken yorulur, baskı kırılır.", strong: "Kadron yüksek baskıya çok uygun — rakibe nefes aldırmazsın." },
    { group: "MF", attrs: ["aggression", "anticipation"], weight: 1.5, gap: "Orta sahanın baskı özellikleri (saldırganlık/öngörü) gegenpress için zayıf." },
    { group: "FW", attrs: ["work_rate", "pace"], weight: 1.5, gap: "Forvetlerin baskı temposu düşük — ilk baskı hattı çalışmaz." },
  ],
  tiki_taka: [
    { group: "team", attrs: ["passing", "technique", "first_touch"], weight: 3, gap: "Kadronun pas/teknik seviyesi kısa pas oyunu için yetersiz — top kayıpları artar.", strong: "Kadron kısa pas oyununa çok uygun — topu rahat dolaştırırsın." },
    { group: "MF", attrs: ["vision", "composure"], weight: 2, gap: "Orta sahanın vizyon/soğukkanlılığı tiki-taka için düşük." },
  ],
  counter: [
    { group: "FW", attrs: ["pace", "acceleration", "off_the_ball"], weight: 3, gap: "Hücumcuların hızı kontra atak için yetersiz — hızlı hücumlar sönük kalır.", strong: "Hücum hattın kontra atak için ideal — boş alanda durdurulamazsın." },
    { group: "MF", attrs: ["anticipation", "decisions", "passing"], weight: 1.5, gap: "Orta saha kontrayı başlatacak öngörü/pas kalitesinden yoksun." },
    { group: "DF", attrs: ["positioning", "concentration"], weight: 1.5, gap: "Savunman blokta beklerken pozisyon disiplininden yoksun." },
  ],
  direct: [
    { group: "FW", attrs: ["strength", "heading", "jumping"], weight: 3, gap: "Hedef forvet uzun top oyunu için yeterince güçlü değil (Güç/Kafa/Zıplama düşük).", strong: "Forvetlerin uzun top oyunu için biçilmiş kaftan — hava toplarında ezersin." },
    { group: "DF", attrs: ["long_balls"], weight: 1.5, gap: "Savunmanın uzun pas kalitesi düşük — uzun toplar isabetsiz." },
    { group: "MF", attrs: ["anticipation", "work_rate"], weight: 1, gap: "Orta saha ikinci topları toplayamıyor." },
  ],
  wing_play: [
    { group: "wide", attrs: ["crossing", "pace", "dribbling"], weight: 3, gap: "Kanat oyuncularının orta/hız değerleri kanat oyunu için düşük.", strong: "Kanatların hız ve orta kalitesi mükemmel — savunmaları kanattan parçalarsın." },
    { group: "FW", attrs: ["heading", "off_the_ball"], weight: 2, gap: "Forvetlerin kafa/pozisyon alma özellikleri ortaları gole çeviremez." },
  ],
  park_bus: [
    { group: "DF", attrs: ["positioning", "concentration", "tackling", "strength"], weight: 3, gap: "Savunman alçak blok için pozisyon/konsantrasyon eksik — otobüs park etmek işe yaramaz.", strong: "Savunman kaya gibi — alçak blokta geçilmesi çok zor." },
    { group: "GK", attrs: ["reflexes", "one_on_ones", "command_of_area"], weight: 1.5, gap: "Kalecin yoğun baskı altında güven vermiyor." },
    { group: "MF", attrs: ["work_rate", "tackling"], weight: 1, gap: "Orta saha savunmaya yeterince destek vermiyor." },
  ],
  balanced: [
    { group: "team", attrs: ["teamwork", "decisions"], weight: 1.5, target: 10, gap: "Takım oyunu ve karar alma genel olarak zayıf." },
  ],
};

function slotIsWide(formation: string, slotIdx: number): boolean {
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-4-2"];
  const s = slots[slotIdx];
  return !!s && (s.x < 30 || s.x > 70);
}

function groupPlayers(eleven: Player[], tactics: Tactics | null, group: Group): Player[] {
  if (group === "team") return eleven.filter((p) => p.position !== "GK");
  if (group === "wide") {
    // Diziliş slotu geniş olanlar; lineup eşleşmesi yoksa pozisyonla yaklaşık
    const formation = tactics?.formation ?? "4-4-2";
    const lineup = tactics?.lineup ?? {};
    const wide: Player[] = [];
    for (const [slot, pid] of Object.entries(lineup)) {
      if (slotIsWide(formation, Number(slot))) {
        const p = eleven.find((e) => e.id === pid);
        if (p) wide.push(p);
      }
    }
    if (wide.length) return wide;
    return eleven.filter((p) => p.position === "MF" || p.position === "FW").slice(0, 4);
  }
  return eleven.filter((p) => p.position === group);
}

function groupAvg(players: Player[], attrs: AttributeKey[]): number {
  if (!players.length) return 10;
  let s = 0, n = 0;
  for (const p of players) for (const k of attrs) {
    const v = (p as any)[k];
    if (typeof v === "number") { s += v; n++; }
  }
  return n ? s / n : 10;
}

// Ayar-düzeyi kontroller (stilden bağımsız, seçili ayarlara göre)
function settingReqs(t: Tactics | null): Req[] {
  const reqs: Req[] = [];
  if (t?.advanced?.defensive_line === "high") {
    reqs.push({ group: "DF", attrs: ["pace", "acceleration"], weight: 1.5, gap: "Stoperlerin yüksek savunma hattı için hızı yetersiz — arkaya atılan toplarda savunman geçilir." });
  }
  if (t?.pressing === "high") {
    reqs.push({ group: "team", attrs: ["work_rate", "stamina", "aggression"], weight: 1.5, gap: "Kadro yüksek pres için yeterince çalışkan/dayanıklı değil — oyuncular erken yorulur." });
  }
  if (t?.tempo === "fast") {
    reqs.push({ group: "team", attrs: ["technique", "composure", "first_touch"], weight: 1.5, gap: "Hızlı tempoda teknik/soğukkanlılık eksik — top kayıpları artar." });
  }
  return reqs;
}

export function resolveStyle(t: Tactics | null): TacticStyle {
  const s = t?.style;
  return s && s in STYLE_PRESETS ? s : "balanced";
}

export function computeSquadFit(players: Player[], tactics: Tactics | null): FitResult {
  const style = resolveStyle(tactics);
  const eleven = startingEleven({ teamId: "", name: "", isAi: false, players, tactics });
  const reqs = [...REQUIREMENTS[style], ...settingReqs(tactics)];

  let sumW = 0, sumS = 0;
  const gaps: FitGap[] = [];
  const strengths: string[] = [];

  for (const r of reqs) {
    const grp = groupPlayers(eleven, tactics, r.group);
    const avg = groupAvg(grp, r.attrs);
    const target = r.target ?? 12;
    const s = Math.max(0, Math.min(1, (avg - (target - 4)) / 8)); // avg=target → 0.5
    sumW += r.weight; sumS += r.weight * s;
    if (s < 0.45) gaps.push({ text: r.gap, severity: s < 0.3 ? "high" : "low" });
    else if (s >= 0.75 && r.strong) strengths.push(r.strong);
  }

  const base = sumW ? (sumS / sumW) * 100 : 70;
  const score = Math.round(Math.max(0, Math.min(100, base)));
  return { score, gaps, strengths, style };
}
