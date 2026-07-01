"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Transfer pazarı açıldığında 30 dakikalık yenilemeyi tembel tetikler.
// Sunucu 30 dk geçmediyse iş yapmaz; yeni oyuncu eklendiyse sayfayı tazeler.
export default function MarketAutoRefresh() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const res = await fetch("/api/transfer-market/refresh", { method: "POST" });
        if (!res.ok) return;
        const d = await res.json();
        if (!d.skipped && (d.added > 0 || d.removed > 0)) router.refresh();
      } catch {
        // sessizce yut — yenileme kritik değil
      }
    })();
  }, [router]);

  return null;
}
