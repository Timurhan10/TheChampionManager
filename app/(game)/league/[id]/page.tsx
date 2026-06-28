import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function LeagueDetailPage() {
  return (
    <>
      <PageTopBar title="Lig Tablosu" subtitle="Sezon & fikstür" />
      <ComingSoon
        title="Lig Tablosu & Takvim"
        phase="Faz 2"
        desc="Tam puan tablosu (O/G/B/M/AG/YG/AV/P), terfi & küme düşme bölgeleri ve haftalık maç takvimi."
      />
    </>
  );
}
