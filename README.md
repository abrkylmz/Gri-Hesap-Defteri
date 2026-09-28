# Gri Hesap Defteri

Aylık gelir ve giderleri tutmak için kişisel bir defter. Veriler Supabase (Postgres) üzerinde saklanır. Aynı hesapla hangi cihazdan girersen gir aynı defteri görürsün. iPhone ve Android'de "Ana Ekrana Ekle" ile uygulama gibi çalışır (PWA).

**Teknoloji:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth + Postgres + RLS) · Zod · Vitest

---

## Kurulum (bir kez, yaklaşık 10 dakika)

### 1. Supabase projesi
1. [supabase.com](https://supabase.com) adresinde ücretsiz bir proje oluştur (bölge olarak Frankfurt, Türkiye'ye en yakın seçenek).
2. **SQL Editor → New query** ekranına [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını yapıştırıp **Run**'a bas.
3. **Project Settings → API** ekranından iki değeri kopyala:
   - `Project URL` değeri `NEXT_PUBLIC_SUPABASE_URL` olacak
   - `Publishable key` (eski projelerde `anon` key) değeri `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` olacak

### 2. Yerelde çalıştırma
```bash
cp .env.example .env.local   # değerleri doldur
npm install
npm run dev                  # http://localhost:3000
```

### 3. Vercel'e alma
1. Projeyi GitHub'a gönder, ardından Vercel'de **Add New → Project** ile içe aktar.
2. **Environment Variables** bölümüne şunları ekle:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`, örneğin `https://gri-defter.vercel.app`
3. Deploy et.

### 4. E-posta bağlantılarını ayarla (önemli)
Supabase → **Authentication → URL Configuration**:
- **Site URL:** Vercel adresin (örn. `https://gri-defter.vercel.app`)
- **Redirect URLs:** `https://gri-defter.vercel.app/**` ve `http://localhost:3000/**`

Supabase → **Authentication → Email Templates**. Onay e-postasının başka bir cihazda açıldığında da çalışması için bağlantıları şöyle değiştir:

| Şablon | Bağlantı (`href`) |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

> Sadece kendin kullanacaksan, kayıt olduktan sonra **Authentication → Sign In / Providers → Allow new users to sign up** seçeneğini kapatabilirsin. Böylece başkası hesap açamaz.

---

## Verilerin güvenliği
- **Row Level Security:** Her tablo yalnızca `auth.uid()` sahibine açıktır. Veritabanı seviyesinde uygulandığı için uygulama kodunda bir hata olsa bile başka kullanıcının verisi okunamaz.
- **Bileşik foreign key'ler:** Bir işlem, başka kullanıcının ya da yanlış türün (gelir/gider) kategorisine bağlanamaz.
- **Tutarlar kuruş cinsinden tam sayı** olarak tutulur, bu yüzden kayan nokta yuvarlama hatası olmaz.
- **Silinen kategori** kayıtları silmez; o kayıtlar "Kategorisiz" olarak kalır.
- **Yedek:** Ayarlar → *CSV indir* ile tüm kayıtlar Excel uyumlu bir dosyaya aktarılır. Supabase ücretsiz planda da günlük yedek alır.

## Özellikler
- **Ayın barkodu:** Her gün bir çizgidir. Çizginin boyu o günün giderini gösterir, yeşil çentik gelir girişini işaretler. Bir çizgiye dokununca defter o güne göre filtrelenir.
- **Hızlı giriş:** Özel tuş takımı var (masaüstünde klavyeyle de kullanılır; `N` yeni kayıt açar, `Enter` kaydeder). Son kullanılan kategori hatırlanır. Geri silme tuşuna basılı tutunca tutar temizlenir.
- **Düzenli kayıtlar:** Kira, maaş ve abonelikler her ayın ilgili gününde deftere otomatik yazılır. İşlem idempotent'tir; iki cihazdan aynı anda açılsa bile tekrar yazılmaz, sildiğin bir kayıt da geri gelmez.
- **Bütçe cetvelleri:** Gider kategorilerine aylık bütçe konabilir, aşımda cetvel turuncuya döner.
- Tempo tahmini, geçen ayla karşılaştırma, 6 aylık trend, ay sonu beklenen net, arama ve filtreler.
- Açık/koyu tema (sistemi izler), Türkçe biçimlendirme; TRY, USD, EUR ve GBP para birimleri.

## Komutlar
| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm test` | Birim testleri (para, tarih, özet, tuş takımı) |
| `npm run lint` / `npm run typecheck` | Kod kalitesi |

## Proje yapısı
```
supabase/schema.sql        Veritabanı: tablolar, RLS, tetikleyiciler, fonksiyonlar
src/proxy.ts               Oturum yenileme ve korumalı rotalar
src/lib/                   Veri erişimi, sunucu aksiyonları, para/tarih/özet mantığı
src/components/ledger/     Defter ekranı (barkod, dağılım, trend, liste)
src/components/tx-sheet    Hızlı giriş çekmecesi
src/app/(app)/             Oturum gerektiren sayfalar
```
