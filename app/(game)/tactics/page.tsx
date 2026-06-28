import PageTopBar from "@/components/PageTopBar";
import ComingSoon from "@/components/ComingSoon";

export default function TacticsPage() {
  return (
    <>
      <PageTopBar title="Taktik Kurulum" subtitle="Diziliş & ayarlar" />
      <ComingSoon
        title="Taktik Kurulum"
        phase="Faz 3"
        desc="Diziliş seçimi, sürükle-bırak saha dizilimi, mentalite/pressing/tempo ayarları ve yedek kulübesi."
      />
    </>
  );
}
