// Ortak yardımcı fonksiyonlar

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Sayıyı binlik ayraçla biçimle (1.240 gibi — TR locale)
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(n);
}

export function formatCR(n: number): string {
  return `${formatNumber(n)} CR`;
}

// İki harf/üç harf takım rozeti üretici (ör. "Anadolu FK" -> "AFK")
export function teamBadge(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

// Hex rengi Phaser sayısal renge çevirir (ör. "#3B82F6" -> 0x3B82F6)
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16) || 0xffffff;
}

// Rastgele davet kodu (8 karakter, okunabilir)
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
