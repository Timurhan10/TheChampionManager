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
| **Faz 3** | Taktik sistemi + maç simülasyon motoru + maç tamamlama | ⏳ |
| **Faz 4** | Scouting + transfer pazarı + alt yapı | ⏳ |
| **Faz 5** | Phaser.js 2D canlı maç + Socket.io | ⏳ |
| **Faz 6** | CMP mağazası + sezon sonu + iyzico abonelik + bildirimler | ⏳ |

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
- **Cron** (`/api/cron/trigger-matches` + `vercel.json`): her 15 dk vadesi gelen maçları tespit eder (motor Faz 3'te bağlanacak).

Diğer ekranlar (Transfer, Scouting, Alt Yapı, Taktik, Maç, CMP) ilgili fazda doldurulmak üzere iskelet empty-state olarak mevcuttur.
