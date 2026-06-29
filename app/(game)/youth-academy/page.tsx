import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function YouthAcademyPage() {
  return (
    <>
      <PageTopBar title="Alt Yapı" subtitle="Akademi yönetimi" />
      <ComingSoon
        title="Alt Yapı Akademisi"
        phase="Faz 4"
        desc="Akademiyi aktif et (haftalık 1.000 CR), sezon sonu genç oyuncu üretimi ve olgunlaşma takibi."
      />
    </>
  );
}
