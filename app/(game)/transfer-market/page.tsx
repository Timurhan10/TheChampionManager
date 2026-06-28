import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function TransferMarketPage() {
  return (
    <>
      <PageTopBar title="Transfer Pazarı" subtitle="Sürekli açık pazar" />
      <ComingSoon
        title="Transfer Pazarı"
        phase="Faz 4"
        desc="Satışa çıkan oyuncular, serbest ajanlar, teklif verme ve gelen teklifleri yönetme."
      />
    </>
  );
}
