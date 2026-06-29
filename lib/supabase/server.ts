import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Env yoksa build/runtime çökmesin diye güvenli yer tutucular.
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

// Sunucu bileşeni / route handler Supabase istemcisi
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    SUPA_URL,
    SUPA_ANON,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component içinden çağrıldığında set edilemez; middleware oturumu yeniler.
          }
        },
      },
    }
  );
}

// Service role istemcisi — RLS'yi bypass eden sunucu-içi işlemler için (cron, oyuncu üretimi vb.)
export function createServiceClient() {
  return createServerClient(
    SUPA_URL,
    SUPA_SERVICE,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );
}
