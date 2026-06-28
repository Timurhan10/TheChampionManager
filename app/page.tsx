"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // Zaten girişliyse yönlendir
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/dashboard");
    });
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.replace("/onboarding");
        } else {
          setInfo("Kayıt başarılı. E-postanı doğrula, sonra giriş yap.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg-base">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald rotate-45 rounded-lg" />
          <div className="leading-none">
            <div className="font-display font-extrabold text-2xl tracking-[1.5px]">CHAMPION</div>
            <div className="font-display font-semibold text-sm tracking-[5px] text-emerald">MANAGER</div>
          </div>
        </div>

        <div className="bg-panel border border-border-cm rounded-card p-6 shadow-frame">
          {/* Sekmeler */}
          <div className="flex gap-1 mb-6 bg-panel-inset rounded-lg p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setInfo(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                  mode === m ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm"
                }`}
              >
                {m === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="section-label block mb-1.5">E-posta</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald"
                placeholder="menajer@ornek.com"
              />
            </div>
            <div>
              <label className="section-label block mb-1.5">Şifre</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            {info && <p className="text-sm text-emerald-bright">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright transition-colors disabled:opacity-50"
            >
              {loading ? "..." : mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-faint mt-6">
          The Champion Manager — Online Futbol Menajerliği
        </p>
      </div>
    </div>
  );
}
