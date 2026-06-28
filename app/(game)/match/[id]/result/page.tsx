import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function MatchResultPage() {
  return (
    <>
      <PageTopBar title="Maç Sonucu" subtitle="Maç özeti" />
      <ComingSoon
        title="Maç Geçmişi"
        phase="Faz 3"
        desc="Skor, maç olayları feed'i ve iki takımın istatistikleri."
      />
    </>
  );
}
