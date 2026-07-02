# The Champion Manager ⚽

Tarayıcı tabanlı online futbol menajerlik oyunu (Football Manager / Championship Manager esinli). Telif yok — kullanıcılar kendi takım ve oyuncu isimlerini belirler.

## Teknik Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database / Auth:** PostgreSQL via Supabase (`@supabase/ssr`)
- **2D Maç Animasyonu:** Phaser.js 3 _(Faz 5)_
- **Real-time:** Socket.io _(Faz 5)_
- **Ödeme:** iyzico _(Faz 6)_

## Para Sistemi

- **Kredi (CR):** Operasyonel para. Başlangıç 100.000 CR. Galibiyet +4.000, Beraberlik +1.500, Mağlubiyet +500.
- **CM Puanı (CMP):** Başarı parası. Şampiyon +500, 2. +250, 3. +100.

## Oyuncu Sistemi

44 attribute (1-20 skala), 4 kategori: Teknik (14), Zihinsel (14), Fiziksel (8), Kaleci (8). Gizli potansiyel yaşa göre belirlenir; scouting + antrenman ile attribute'lar açılır/gelişir.

## Kurulum

```bash
npm install
cp .env.local.example .env.local   # değerleri doldur
npm run dev
```

### Environment Variables

`.env.local.example` dosyasına bakın. Supabase URL/anon key/service role key zorunludur.

### Veritabanı

`supabase/migrations/0001_initial_schema.sql` dosyasını Supabase SQL editöründe çalıştırın. Tüm tablolar, ENUM'lar, indeksler ve RLS politikaları bu dosyadadır.

## Klasör Yapısı

```
/app                  Next.js App Router sayfaları
  /(game)             Auth korumalı oyun ekranları (sidebar + topbar kabuğu)
  /api                API route'ları
/components           Paylaşılan UI bileşenleri (Sidebar, TopBar, AttributeBar...)
/lib                  Supabase client, oyuncu üretici, attribute tanımları, yardımcılar
/lib/supabase         client / server / middleware Supabase yapılandırması
/types                TypeScript tip tanımları
/supabase/migrations  SQL şema migration'ları
```

## Geliştirme Durumu (Faz Yol Haritası)

| Faz | Kapsam | Durum |
|-----|--------|-------|
| **Faz 0** | Proje kurulumu + tam veritabanı şeması + Supabase client + routing iskeleti + auth middleware | ✅ Tamam |
| **Faz 1** | Kayıt/giriş, 3 adımlı takım & 25 oyuncu oluşturma, dashboard, kadro listesi, oyuncu profili | ✅ Tamam |
| **Faz 2** | Lig oluşturma/katılma, AI takımları, round-robin fikstür, puan tablosu, cron | ✅ Tamam |
| **Faz 3** | Taktik sistemi + maç simülasyon motoru + maç tamamlama | ✅ Tamam |
| **Faz 4** | Scouting + transfer pazarı + alt yapı | ✅ Tamam |
| **Faz 5** | Phaser.js 2D canlı maç + Socket.io | ✅ Tamam |
| **Faz 6** | CMP mağazası + sezon sonu + iyzico abonelik + bildirimler | ✅ Tamam |

### Tamamlanan Özellikler (Faz 0–1)

- Tam veritabanı şeması: `users`, `teams`, `players` (44 attribute kolonu), `leagues`, `league_teams`, `matches`, `tactics`, `transfers`, `scouting_reports`, `youth_academy`, `cmp_shop_items`, `cmp_purchases` + RLS.
- Supabase Auth (email + şifre), `/game/*` route koruması için middleware.
- 3 adımlı onboarding wizard (takım adı/renkler → 25 oyuncu → özet), pozisyon kuralları (min 1 GK, 4 DF, 4 MF, 3 FW).
- Sunucu tarafında güvenli oyuncu üretimi (attribute 8-12 random + pozisyon eğilimi, yaşa göre potansiyel, otomatik değer hesabı, TR + uluslararası isim üretici).
- Dashboard (CR/CMP/kadro özeti), kadro sayfası (pozisyona gruplu, ortalama rating), oyuncu profil sayfası (4 kategori attribute panelleri, kendi oyuncularda tam görünüm — diğerleri gizli `?`).
- README handoff'undaki tasarım token'larına uygun tema (renkler, Saira + IBM Plex Sans tipografi, sidebar + topbar kabuğu).

### Tamamlanan Özellikler (Faz 2)

- **Lig oluşturma** (`/api/leagues/create`): lig adı, 2 maç günü, saat, benzersiz 8 karakterli davet kodu; kurucunun takımı otomatik eklenir.
- **Lige katılma** (`/api/leagues/join`): davet kodu ile katılım; 12 insan takımına ulaşınca otomatik başlar.
- **Ligi başlatma** (`/api/leagues/start`): kurucu eksik slotları AI takımlarıyla doldurur (her biri 25 oyunculu, attribute 8-14), fikstür üretilir, `status='active'`.
- **Round-robin fikstür** (`lib/schedule-generator.ts`): 12 takım çift devreli = 22 tur / 132 maç, haftada tam 2 maç, 11 hafta. Maçlar lig maç günleri + saatine bağlanır.
- **Lig detay sayfası**: tam puan tablosu (O/G/B/M/AG/YG/AV/P), kendi takım vurgusu, terfi (1-3) & küme düşme bölgeleri, haftalara gruplu fikstür.
- **Cron** (`/api/cron/daily` + `vercel.json`): günlük tek orkestratör — vadesi gelen maçlar, scout raporları, pazar rotasyonu, oyuncu değeri tazeleme.

### Tamamlanan Özellikler (Faz 3)

- **Taktik sayfası** (`/tactics`): 6 diziliş (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1), saha üzerinde slot-bazlı kadro seçimi, mentalite/pressing/tempo/geçiş segment kontrolleri, yedek seçimi (max 7), **otomatik kaydetme** (debounce). Maça kadar serbest, kilitleme yok.
- **Taktik kaydetme** (`/api/tactics/save`): `tactics` tablosuna upsert.
- **Maç simülasyon motoru** (`lib/match-engine/simulator.ts`): kadro + taktikten atak/defans/orta saha gücü hesabı, Poisson tabanlı gol üretimi, ev sahibi avantajı, mentalite (hücumcu +%20 gol şansı) & pressing etkileri, pozisyon-ağırlıklı golcü seçimi, kart/değişiklik olayları, top hakimiyeti/şut/korner istatistikleri, maçın adamı. _200 maçlık testte 0 çökme, ~2.6 gol/maç._
- **Maç tamamlama** (`lib/match-engine/run.ts` + `/api/matches/complete`): skor + olaylar + istatistik kaydı, puan tablosu güncellemesi (G/B/M, goller), CR ödülleri (galibiyet +4.000 / beraberlik +1.500 / mağlubiyet +500).
- **Cron entegrasyonu**: `/api/cron/daily` vadesi gelen maçları simüle edip tamamlıyor (AI-vs-AI; insan maçları canlı oynanır, 3 gün gecikince otomatik).
- **Maç sonucu sayfası** (`/match/[id]/result`): skor, MotM, dakika-dakika olay feed'i (GOL/SK/KRT/DEĞ/İY/MS), karşılaştırmalı istatistik barları. Lig fikstüründe biten maçlar buraya linkli.

### Tamamlanan Özellikler (Faz 4)

- **Scouting** (`/scouting` + `/api/scouting/*`): Temel (500 CR, anlık) / Detaylı (2.000 CR, 12 saat) / Tam (5.000 CR, 48 saat) paketleri; açılan özellik sayısı pakete + scout seviyesine bağlı; oyuncu arama, aktif görevler, tamamlanan raporlar; scout seviyesi yükseltme (30.000 CR, max 3). Oyuncu profilinde **kısmi açığa çıkarma** (scout edilen özellikler değerleriyle, diğerleri `?`).
- **Transfer Pazarı** (`/transfer-market` + `/api/transfers/*`, `/api/players/list-for-sale`): satıştaki oyuncular + serbest ajanlar listesi, scout durumuna göre rating görünürlüğü; oyuncu profilinden satışa çıkarma/kaldırma, teklif verme, serbest ajanı direkt satın alma; gelen tekliflerde kabul/red (oyuncu + CR el değiştirir, diğer teklifler iptal olur).
- **Alt Yapı** (`/youth-academy` + `/api/youth-academy/*`): aktif/pasif toggle (haftalık 1.000 CR), sezon sonu genç oyuncu üretimi (1-3 oyuncu, 16-19 yaş, yüksek potansiyel, gizli özellikler), akademi oyuncu listesi.
- **Cron**: `/api/scouting/complete` (15 dk) bekleyen scout raporlarını tamamlar.
- **Migration 0002**: `teams.scout_level` kolonu + indeksler.

### Tamamlanan Özellikler (Faz 5)

- **Phaser.js 2D maç sahnesi** (`game/matchGame.ts`): yeşil saha (çizgiler, ceza alanları, orta daire), ev sahibi (mavi, alt yarı) / deplasman (kırmızı, üst yarı) oyuncu daireleri, beyaz top; idle hareket tween'leri; gol flash + konfeti, kart animasyonu, skor/dakika overlay'i. Yalnızca client'ta dinamik import edilir (SSR güvenli).
- **Maç izleme sayfası** (`/match/[id]`): React + Phaser entegrasyonu (`MatchCanvas`), biten maçların `match_events`'ini **zaman çizelgesinde replay** eder — başlat/duraklat/baştan + 0.5x/1x/2x hız kontrolleri, canlı yorum feed'i, istatistik paneli. Maç başlamadıysa **maç öncesi geri sayım** (`PreMatch`) + "Taktiği Hazırla" linki.
- **Socket.io sunucusu** (`services/socket-server/`): Railway için ayrı Node servisi (Express + Socket.io), `match-{id}` oda sistemi, maç motorunun olay yayınlaması için korumalı `/emit` ucu, Dockerfile + README. Frontend `lib/match-socket.ts` ile `NEXT_PUBLIC_SOCKET_URL` ayarlıysa canlı bağlanır; değilse replay moduna düşer (altyapı gerektirmez).

### Dağıtım (Deployment)

- **Frontend (Vercel):** Repo kökünü deploy et; `.env.local.example`'daki değişkenleri Vercel env olarak ekle. `vercel.json` cron'ları otomatik kurulur.
- **Socket sunucusu (Railway):** `services/socket-server` klasörünü/Dockerfile'ı kullan; `EMIT_SECRET` + `CORS_ORIGIN` ayarla; public URL'i frontend'de `NEXT_PUBLIC_SOCKET_URL` yap.

### Tamamlanan Özellikler (Faz 6)

- **CMP Mağazası** (`/cmp-shop` + `/api/cmp-shop/purchase`): Bronz/Gümüş/Altın tier ürünleri, bakiye banner'ı, yetersiz bakiyede kilitli görünüm ("X CMP eksik"), geri-alınamaz **onay modalı**, satın alma geçmişi. Ödül tipleri: CR bonusu, genç/elite/efsane/veteran oyuncu üretimi, scout seviyesi yükseltme, takım antrenman bonusu.
- **Sezon Sonu** (`/api/seasons/end` + lig sayfasında kurucu butonu): tüm maçlar bitince CMP dağıtımı (şampiyon +500, 2. +250, 3. +100, yenilgisiz +300), her menajere +100.000 CR sezon bonusu, aktif alt yapılara genç üretimi, puan tablosu sıfırlama, yeni sezon fikstürü, `season_number +1`.
- **Bildirimler** (`notifications` tablosu + `/api/notifications/mark-read`): transfer teklifi/sonucu, scout tamamlandı, sezon sonu, CMP satın alma olaylarında bildirim; dashboard'da panel + okundu işaretleme.
- **iyzico Abonelik** (`/api/payment/subscribe`): yapılandırma-bilinçli iskelet — anahtarlar yoksa net "yapılandırılmamış" yanıtı; gerçek checkout akışı için bağlanma noktası hazır.
- **Migration 0003**: CMP ürün seed'i + `notifications` tablosu (RLS ile). Alternatif: `scripts/seed-cmp-shop.ts`.

---

## 🎉 Tüm Fazlar Tamamlandı

Faz 0-6 bitti. Oyun döngüsü uçtan uca işliyor: **kayıt → takım & 25 oyuncu kur → lig oluştur/katıl → taktik kur → maçlar simüle olur (2D izlenebilir) → puan tablosu + CR/CMP güncellenir → scout/transfer/alt yapı ile kadro geliştir → CMP mağazasından ödül al → sezon sonu yeni sezon başlar.**

Production için: Supabase'de 3 migration'ı sırayla çalıştır, `.env.local`'i doldur, frontend'i Vercel'e, socket sunucusunu Railway'e deploy et.
