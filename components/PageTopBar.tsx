"use client";

import TopBar from "./TopBar";
import { useGameContext } from "./GameContextProvider";

// CR/CMP/rozet bilgilerini context'ten alıp her sayfada başlık/alt başlıkla TopBar render eder.
export default function PageTopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { cr, cmp, teamBadge } = useGameContext();
  return <TopBar title={title} subtitle={subtitle} badge={teamBadge} cr={cr} cmp={cmp} />;
}
