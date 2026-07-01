// Formasyondan normalize tam-saha taban pozisyonları üretir.
// Koordinat: x ∈ [0,1] genişlik, y ∈ [0,1] boy. y=0 üst (deplasman kalesi),
// y=1 alt (ev sahibi kalesi). Ev sahibi yukarı (y azalan) hücum eder.
import { FORMATIONS } from "@/lib/formations";

export function basePositions(formation: string, side: "home" | "away"): { x: number; y: number }[] {
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-4-2"];
  return slots.map((s) => {
    const x = s.x / 100;          // 0..1
    const yHalf = s.y / 100;      // taktik yarısında 0..1 (GK ~0.92)
    if (side === "home") {
      // Alt yarı: GK ~0.96 (kendi kalesi), FW ~0.62 (orta sahaya yakın)
      return { x, y: 0.5 + yHalf * 0.5 };
    }
    // Üst yarı, yatay+dikey aynalanmış
    return { x: 1 - x, y: 0.5 - yHalf * 0.5 };
  });
}
