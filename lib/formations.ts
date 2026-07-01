// Diziliş şablonları ve küçük yardımcılar — TacticsBoard ve FirstElevenEditor paylaşır.
import type { Position } from "@/types/game";

export type Slot = { role: Position; x: number; y: number };

export const FORMATIONS: Record<string, Slot[]> = {
  "4-4-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 72 }, { role: "DF", x: 38, y: 74 }, { role: "DF", x: 62, y: 74 }, { role: "DF", x: 84, y: 72 },
    { role: "MF", x: 16, y: 48 }, { role: "MF", x: 38, y: 50 }, { role: "MF", x: 62, y: 50 }, { role: "MF", x: 84, y: 48 },
    { role: "FW", x: 36, y: 24 }, { role: "FW", x: 64, y: 24 },
  ],
  "4-3-3": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 72 }, { role: "DF", x: 38, y: 74 }, { role: "DF", x: 62, y: 74 }, { role: "DF", x: 84, y: 72 },
    { role: "MF", x: 28, y: 50 }, { role: "MF", x: 50, y: 52 }, { role: "MF", x: 72, y: 50 },
    { role: "FW", x: 22, y: 26 }, { role: "FW", x: 50, y: 22 }, { role: "FW", x: 78, y: 26 },
  ],
  "4-2-3-1": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 74 }, { role: "DF", x: 38, y: 76 }, { role: "DF", x: 62, y: 76 }, { role: "DF", x: 84, y: 74 },
    { role: "MF", x: 36, y: 58 }, { role: "MF", x: 64, y: 58 },
    { role: "MF", x: 24, y: 40 }, { role: "MF", x: 50, y: 38 }, { role: "MF", x: 76, y: 40 },
    { role: "FW", x: 50, y: 22 },
  ],
  "3-5-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 28, y: 74 }, { role: "DF", x: 50, y: 76 }, { role: "DF", x: 72, y: 74 },
    { role: "MF", x: 12, y: 50 }, { role: "MF", x: 32, y: 52 }, { role: "MF", x: 50, y: 54 }, { role: "MF", x: 68, y: 52 }, { role: "MF", x: 88, y: 50 },
    { role: "FW", x: 38, y: 24 }, { role: "FW", x: 62, y: 24 },
  ],
  "5-3-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 10, y: 72 }, { role: "DF", x: 30, y: 76 }, { role: "DF", x: 50, y: 78 }, { role: "DF", x: 70, y: 76 }, { role: "DF", x: 90, y: 72 },
    { role: "MF", x: 28, y: 50 }, { role: "MF", x: 50, y: 52 }, { role: "MF", x: 72, y: 50 },
    { role: "FW", x: 38, y: 26 }, { role: "FW", x: 62, y: 26 },
  ],
  "4-1-4-1": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 74 }, { role: "DF", x: 38, y: 76 }, { role: "DF", x: 62, y: 76 }, { role: "DF", x: 84, y: 74 },
    { role: "MF", x: 50, y: 60 },
    { role: "MF", x: 16, y: 44 }, { role: "MF", x: 38, y: 44 }, { role: "MF", x: 62, y: 44 }, { role: "MF", x: 84, y: 44 },
    { role: "FW", x: 50, y: 24 },
  ],
};

export function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : name;
}
