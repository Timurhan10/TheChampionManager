"use client";

import { useRouter } from "next/navigation";

// Önceki sayfaya akıcı dönüş. Geçmiş yoksa fallback rotasına gider.
export default function BackButton({ label = "Geri", fallback = "/dashboard" }: { label?: string; fallback?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-cm mb-3"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
