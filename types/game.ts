import type { AttributeKey } from "@/lib/attributes";

export type Position = "GK" | "DF" | "MF" | "FW";

export type PlayerAttributes = Partial<Record<AttributeKey, number | null>>;

export interface Player extends PlayerAttributes {
  id: string;
  team_id: string | null;
  name: string;
  age: number;
  position: Position;
  is_youth_academy: boolean;
  potential: number | null;
  value_cr: number;
  for_sale: boolean;
  asking_price: number | null;
  created_at: string;
}

export interface Team {
  id: string;
  user_id: string | null;
  name: string;
  primary_color: string;
  secondary_color: string;
  is_ai: boolean;
  created_at: string;
}

export interface GameUser {
  id: string;
  username: string;
  credits: number;
  cmp_points: number;
  created_at: string;
}

export interface Tactics {
  id: string;
  team_id: string;
  formation: string;
  mentality: string;
  pressing: string;
  tempo: string;
  pass_style: string;
  lineup: Record<string, string>; // pozisyon slotu -> player_id
  substitutes: string[];
  updated_at: string;
}

export interface MatchEvent {
  minute: number;
  type: "goal" | "yellow" | "red" | "sub" | "half_time" | "full_time" | "chance";
  team: "home" | "away";
  playerId?: string;
  playerName?: string;
  text: string;
}
