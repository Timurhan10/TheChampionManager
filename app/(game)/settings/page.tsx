"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useGameContext } from "@/components/GameContextProvider";
import TopBar from "@/components/TopBar";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { cr, cmp, teamBadge, username, teamName } = useGameContext();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <>
      <TopBar title="Ayarlar" subtitle="Hesap" badge={teamBadge} cr={cr} cmp={cmp} />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <div className="max-w-lg space-y-4">
          <div className="bg-panel border border-border-cm rounded-card p-5">
            <div className="section-label mb-3">Hesap Bilgileri</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Menajer</span><span>{username}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Takım</span><span>{teamName}</span></div>
            </div>
          </div>
          <button onClick={signOut} className="w-full border border-danger text-danger font-semibold py-2.5 rounded-lg hover:bg-danger/10">
            Çıkış Yap
          </button>
        </div>
      </div>
    </>
  );
}
