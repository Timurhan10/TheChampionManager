import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function LeaguePage() {
  return (
    <>
      <PageTopBar title="Lig" subtitle="Lig oluştur veya katıl" />
      <ComingSoon
        title="Lig Sistemi"
        phase="Faz 2"
        desc="Lig oluşturma, davet kodu ile katılma, 12 takımlı round-robin fikstür ve puan tablosu burada olacak."
      />
    </>
  );
}
