import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function ScoutingPage() {
  return (
    <>
      <PageTopBar title="Scouting Merkezi" subtitle="Yetenek keşfi" />
      <ComingSoon
        title="Scouting Merkezi"
        phase="Faz 4"
        desc="Temel/Detaylı/Tam scout paketleri, aktif görevler, tamamlanan raporlar ve scout seviyesi yükseltme."
      />
    </>
  );
}
