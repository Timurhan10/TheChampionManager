import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function MatchPage() {
  return (
    <>
      <PageTopBar title="Canlı Maç" subtitle="2D maç izleme" />
      <ComingSoon
        title="Canlı 2D Maç"
        phase="Faz 5"
        desc="Phaser.js 2D maç animasyonu, Socket.io ile canlı olaylar, skor ve istatistikler."
      />
    </>
  );
}
