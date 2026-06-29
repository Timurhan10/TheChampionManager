import { createBrowserClient } from "@supabase/ssr";

// Env değişkenleri henüz girilmemişse build/runtime çökmesin diye güvenli yer tutucular.
// (Gerçek değerler Vercel ortam değişkenlerinden gelir; girilmeden auth çalışmaz ama site açılır.)
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Tarayıcı (client component) Supabase istemcisi
export function createClient() {
  return createBrowserClient(URL, ANON);
}
