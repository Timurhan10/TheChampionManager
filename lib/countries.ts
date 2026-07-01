// Ülke bazlı scouting: 8 ülke, her biri için özellik eğilim profili + isim havuzu.
import type { AttributeKey } from "./attributes";

export interface Country {
  key: string;
  name: string;
  flag: string;
  bias: AttributeKey[];   // öne çıkan özellikler (üretimde +bump)
  first: string[];
  last: string[];
}

export const COUNTRIES: Country[] = [
  { key: "BR", name: "Brezilya", flag: "🇧🇷", bias: ["dribbling", "technique", "agility", "flair", "off_the_ball", "first_touch"],
    first: ["Lucas", "Gabriel", "Rafael", "Matheus", "Bruno", "Thiago"], last: ["Silva", "Santos", "Souza", "Oliveira", "Costa", "Almeida"] },
  { key: "AR", name: "Arjantin", flag: "🇦🇷", bias: ["technique", "vision", "flair", "decisions", "composure", "dribbling"],
    first: ["Mateo", "Julian", "Nicolas", "Lautaro", "Diego", "Enzo"], last: ["Fernandez", "Martinez", "Gonzalez", "Alvarez", "Romero", "Diaz"] },
  { key: "EN", name: "İngiltere", flag: "🏴", bias: ["strength", "stamina", "pace", "work_rate", "heading", "tackling"],
    first: ["Harry", "Jack", "Callum", "Marcus", "Phil", "Declan"], last: ["Smith", "Walker", "Sterling", "Rice", "Kane", "Foden"] },
  { key: "FR", name: "Fransa", flag: "🇫🇷", bias: ["pace", "acceleration", "strength", "agility", "off_the_ball"],
    first: ["Kylian", "Hugo", "Ousmane", "Aurelien", "Theo", "Adrien"], last: ["Dembele", "Camavinga", "Tchouameni", "Coman", "Konate", "Saliba"] },
  { key: "TR", name: "Türkiye", flag: "🇹🇷", bias: ["determination", "aggression", "work_rate", "bravery", "stamina"],
    first: ["Arda", "Kerem", "Cengiz", "Hakan", "Emre", "Yusuf"], last: ["Yıldız", "Demir", "Çalhanoğlu", "Aktürkoğlu", "Kaya", "Şahin"] },
  { key: "NL", name: "Hollanda", flag: "🇳🇱", bias: ["passing", "vision", "teamwork", "decisions", "technique", "positioning"],
    first: ["Frenkie", "Cody", "Xavi", "Jurrien", "Denzel", "Nathan"], last: ["de Jong", "Gakpo", "Simons", "Timber", "Dumfries", "Ake"] },
  { key: "IT", name: "İtalya", flag: "🇮🇹", bias: ["positioning", "tackling", "concentration", "anticipation", "composure", "heading"],
    first: ["Marco", "Alessandro", "Federico", "Nicolo", "Gianluca", "Sandro"], last: ["Verratti", "Bastoni", "Barella", "Chiesa", "Tonali", "Di Lorenzo"] },
  { key: "ES", name: "İspanya", flag: "🇪🇸", bias: ["passing", "technique", "first_touch", "vision", "composure", "off_the_ball"],
    first: ["Pedri", "Gavi", "Pablo", "Alvaro", "Dani", "Fabian"], last: ["Garcia", "Olmo", "Torres", "Morata", "Ruiz", "Martin"] },
];

export function countryByKey(key: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.key === key);
}

export function randomCountry(): Country {
  return COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
}

export function countryPlayerName(c: Country): string {
  const f = c.first[Math.floor(Math.random() * c.first.length)];
  const l = c.last[Math.floor(Math.random() * c.last.length)];
  return `${f} ${l}`;
}
