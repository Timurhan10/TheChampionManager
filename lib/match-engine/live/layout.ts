// Formasyondan normalize tam-saha taban pozisyonları üretir (YATAY saha).
// Koordinat: x ∈ [0,1] uzunluk (kaleler solda/sağda), y ∈ [0,1] genişlik.
// Ev sahibi SOLDA başlar ve x→1'e (sağa) hücum eder; deplasman x→0'a (sola).
import { FORMATIONS } from "@/lib/formations";

export function basePositions(formation: string, side: "home" | "away"): { x: number; y: number }[] {
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-4-2"];
  return slots.map((s) => {
    const width = s.x / 100;  // taktik tahtasında x = genişlik
    const depth = s.y / 100;  // taktik tahtasında y = derinlik (GK ~0.92 kendi kalesine yakın)
    if (side === "home") {
      // Sol yarı: GK x≈0.08, FW x≈0.39
      return { x: 0.5 - depth * 0.46, y: width };
    }
    // Sağ yarı, aynalı
    return { x: 0.5 + depth * 0.46, y: 1 - width };
  });
}
