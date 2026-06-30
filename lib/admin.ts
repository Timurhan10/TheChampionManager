import type { SupabaseClient } from "@supabase/supabase-js";

// Admin kullanıcı id'leri. `is_admin` kolonu henüz eklenmemişse (migration 0004 öncesi)
// hata vermeden boş döner — böylece bağımlı özellikler erken çalışabilir.
export async function getAdminUserIds(svc: SupabaseClient): Promise<string[]> {
  try {
    const { data, error } = await svc.from("users").select("id").eq("is_admin", true);
    if (error) return [];
    return (data ?? []).map((r: any) => r.id);
  } catch {
    return [];
  }
}

// Admin kullanıcıların takım id'leri.
export async function getAdminTeamIds(svc: SupabaseClient): Promise<string[]> {
  const userIds = await getAdminUserIds(svc);
  if (userIds.length === 0) return [];
  const { data } = await svc.from("teams").select("id").in("user_id", userIds);
  return (data ?? []).map((r: any) => r.id);
}

// Çağıran kullanıcı admin mi? (guard'lar için)
export async function isAdmin(svc: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await svc.from("users").select("is_admin").eq("id", userId).maybeSingle();
    if (error) return false;
    return !!(data as any)?.is_admin;
  } catch {
    return false;
  }
}
