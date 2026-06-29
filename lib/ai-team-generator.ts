// The Champion Manager — Yapay zeka takımı üreticisi
// Eksik lig slotlarını doldurmak için kullanılır.

import { generatePlayer } from "./player-generator";
import type { Position } from "@/types/game";

const CITIES = [
  "Madrid", "Lisbon", "Milano", "Münih", "Porto", "Sevilla", "Napoli",
  "Lyon", "Roma", "Torino", "Atina", "Belgrad", "Zagreb", "Prag",
  "Glasgow", "Leeds", "Bremen", "Köln", "Genova", "Valencia", "Bilbao",
  "Marsilya", "Nantes", "Brugge", "Eindhoven", "Rotterdam", "Salzburg",
];

const SUFFIXES = ["FC", "United", "City", "SK", "AC", "Athletic", "Sporting"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateAiTeamName(used: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const name = `${pick(CITIES)} ${pick(SUFFIXES)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  // Çakışma sürerse sayı ekle
  const name = `${pick(CITIES)} ${pick(SUFFIXES)} ${Math.floor(Math.random() * 99)}`;
  used.add(name);
  return name;
}

const RANDOM_COLORS = ["#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

// AI takımı için 25 oyuncu üretir (attribute 8-14 random).
export function generateAiSquad(): ReturnType<typeof generatePlayer>[] {
  const dist: Position[] = [
    ...Array(2).fill("GK"),
    ...Array(8).fill("DF"),
    ...Array(9).fill("MF"),
    ...Array(6).fill("FW"),
  ];
  return dist.map((position) =>
    generatePlayer({ position, attrMin: 8, attrMax: 14 })
  );
}

export function randomTeamColors(): { primary: string; secondary: string } {
  return {
    primary: pick(RANDOM_COLORS),
    secondary: "#1A2A3E",
  };
}
