import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// iyzico aylık abonelik (15 TL). Gerçek entegrasyon için IYZICO_API_KEY/SECRET gerekir.
// Anahtarlar yoksa net bir "yapılandırılmamış" yanıtı döner (mock ödeme yapmaz).
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const apiKey = process.env.IYZICO_API_KEY;
  const secret = process.env.IYZICO_SECRET_KEY;

  if (!apiKey || !secret) {
    return NextResponse.json({
      error: "Ödeme sağlayıcısı yapılandırılmamış.",
      hint: "IYZICO_API_KEY ve IYZICO_SECRET_KEY ortam değişkenlerini ayarlayın.",
    }, { status: 501 });
  }

  // TODO: iyzipay ile aylık abonelik planı / checkout başlat.
  // const Iyzipay = require("iyzipay");
  // const iyzipay = new Iyzipay({ apiKey, secretKey: secret, uri: "https://api.iyzipay.com" });
  // ... checkout form initialize → paymentPageUrl döndür
  // Başarılı webhook'ta: users.is_subscribed = true

  return NextResponse.json({
    ok: false,
    message: "iyzico entegrasyonu hazır değil — anahtarlar mevcut ancak checkout akışı bağlanmalı.",
  });
}
