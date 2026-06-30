import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getGameContext } from "@/lib/data";
import { teamBadge } from "@/lib/utils";
import GameContextProvider from "@/components/GameContextProvider";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authId, gameUser, team } = await getGameContext();

  if (!authId) redirect("/");

  return (
    <GameContextProvider
      cr={gameUser?.credits ?? 0}
      cmp={gameUser?.cmp_points ?? 0}
      teamName={team?.name ?? "Takım Yok"}
      teamBadge={team ? teamBadge(team.name) : "CM"}
      username={gameUser?.username ?? "Menajer"}
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar teamName={team?.name} username={gameUser?.username} isAdmin={(gameUser as any)?.is_admin === true} />
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-deep">
          {children}
        </div>
      </div>
    </GameContextProvider>
  );
}
