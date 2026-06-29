// The Champion Manager — Maç programı üreticisi
// 12 takım, çift devreli round-robin = 22 tur (her takım 22 maç).
// Haftada 2 tur oynanır → 11 haftalık sezon.

export type MatchDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const DOW: Record<MatchDay, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

export interface ScheduledMatch {
  home_team_id: string;
  away_team_id: string;
  week: number; // 1-tabanlı
  scheduled_at: string; // ISO
}

// Tek devreli round-robin (circle method). Takım sayısı çift olmalı.
function singleRoundRobin(teams: string[]): [string, string][][] {
  const n = teams.length;
  const arr = [...teams];
  const rounds: [string, string][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // Adalet için tur bazında ev/deplasman değiştir
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    // arr[0] sabit, kalanları döndür
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

// Çift devreli: ikinci yarıda ev/deplasman ters çevrilir.
export function doubleRoundRobin(teams: string[]): [string, string][][] {
  const first = singleRoundRobin(teams);
  const second = first.map((round) => round.map(([h, a]) => [a, h] as [string, string]));
  return [...first, ...second];
}

// base tarihinden sonraki ilk istenen gün (bugün hariç).
function firstUpcoming(base: Date, weekday: number): Date {
  const d = new Date(base);
  const diff = ((weekday - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function applyTime(d: Date, time: string): Date {
  const [hh, mm] = time.split(":").map(Number);
  const out = new Date(d);
  out.setHours(hh || 0, mm || 0, 0, 0);
  return out;
}

// Tüm fikstürü tarihlere bağlar. 2 tur = 1 hafta (tur0→gün1, tur1→gün2...).
export function generateSchedule(
  teamIds: string[],
  matchDay1: MatchDay,
  matchDay2: MatchDay,
  matchTime: string,
  startFrom: Date = new Date()
): ScheduledMatch[] {
  if (teamIds.length % 2 !== 0) {
    throw new Error("Takım sayısı çift olmalı.");
  }

  const rounds = doubleRoundRobin(teamIds);
  const anchor1 = firstUpcoming(startFrom, DOW[matchDay1]);
  const anchor2 = firstUpcoming(startFrom, DOW[matchDay2]);

  const matches: ScheduledMatch[] = [];

  rounds.forEach((round, roundIdx) => {
    const week = Math.floor(roundIdx / 2); // 0-tabanlı hafta
    const isFirstDay = roundIdx % 2 === 0;
    const anchor = isFirstDay ? anchor1 : anchor2;

    const day = new Date(anchor);
    day.setDate(day.getDate() + week * 7);
    const scheduledAt = applyTime(day, matchTime).toISOString();

    for (const [home, away] of round) {
      matches.push({
        home_team_id: home,
        away_team_id: away,
        week: week + 1,
        scheduled_at: scheduledAt,
      });
    }
  });

  return matches;
}
