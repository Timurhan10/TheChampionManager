"use client";

import { createContext, useContext } from "react";

interface GameContextValue {
  cr: number;
  cmp: number;
  teamName: string;
  teamBadge: string;
  username: string;
}

const GameContext = createContext<GameContextValue>({
  cr: 0,
  cmp: 0,
  teamName: "—",
  teamBadge: "CM",
  username: "Menajer",
});

export function useGameContext() {
  return useContext(GameContext);
}

export default function GameContextProvider({
  children,
  ...value
}: GameContextValue & { children: React.ReactNode }) {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
