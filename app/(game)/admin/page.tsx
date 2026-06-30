import { redirect } from "next/navigation";
import { getGameContext } from "@/lib/data";
import PageTopBar from "@/components/PageTopBar";
import AdminPanel from "@/components/AdminPanel";
import AdminLeagues from "@/components/AdminLeagues";

export default async function AdminPage() {
  const { authId, gameUser } = await getGameContext();
  if (!authId) redirect("/");
  // Sadece admin erişebilir (is_admin kolonu yoksa undefined → erişim yok)
  if ((gameUser as any)?.is_admin !== true) redirect("/dashboard");

  return (
    <>
      <PageTopBar title="Admin Paneli" subtitle="Sistem & kullanıcı yönetimi" />
      <div className="flex-1 overflow-y-auto p-[22px]">
        <AdminLeagues />
        <AdminPanel />
      </div>
    </>
  );
}
