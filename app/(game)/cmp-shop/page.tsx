import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function CmpShopPage() {
  return (
    <>
      <PageTopBar title="CMP Mağazası" subtitle="Premium ödüller" />
      <ComingSoon
        title="CMP Mağazası"
        phase="Faz 6"
        desc="Bronz/Gümüş/Altın tier ödüller, CR bonusları, elite oyuncular ve satın alma onay akışı."
      />
    </>
  );
}
