# Gri Hesap Defteri

Aylık gelir ve giderleri tutmak için kişisel bir defter. Veriler Neon (Postgres) üzerinde saklanır. Aynı hesapla hangi cihazdan girersen gir aynı defteri görürsün. iPhone ve Android'de "Ana Ekrana Ekle" ile uygulama gibi çalışır (PWA).

**Teknoloji:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Neon Postgres · Neon Auth · Zod · Vitest

---

## Kurulum (bir kez)

### 1. Vercel projesi ve Neon veritabanı
1. [vercel.com/new](https://vercel.com/new) adresinden bu GitHub deposunu içe aktar. İlk deploy, ortam değişkenleri olmadığı için hata verebilir; bu normal.
2. Vercel'de projeyi aç, **Storage → Create Database → Neon** ile yeni bir veritabanı oluştur ve projeye bağla. Bölge olarak Türkiye'ye en yakın seçenek Frankfurt (`eu-central-1`).
   Bu adım `DATABASE_URL` değişkenini otomatik ekler.

### 2. Şemayı oluştur
Vercel'deki veritabanı sayfasından **Open in Neon Console** ile Neon'a geç. **SQL Editor**'a [`db/schema.sql`](db/schema.sql) dosyasının tamamını yapıştırıp çalıştır.

### 3. Neon Auth'u aç
1. Neon Console → projen → **Auth** bölümünden Neon Auth'u etkinleştir.
2. Oradaki **Auth URL** değerini kopyala.
3. Uygulamanın alan adını (örn. `https://gri-defter.vercel.app`) Auth ayarlarında izin verilen alan adları arasına ekle. Bu yapılmazsa şifre sıfırlama bağlantıları uygulamaya dönemez.

### 4. Ortam değişkenleri
Vercel → **Settings → Environment Variables**:

| Değişken | Değer |
|---|---|
| `DATABASE_URL` | Neon entegrasyonu otomatik ekler |
| `NEON_AUTH_BASE_URL` | 3. adımdaki Auth URL |
| `NEON_AUTH_COOKIE_SECRET` | En az 32 karakter rastgele değer (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_SITE_URL` | Uygulamanın adresi, örn. `https://gri-defter.vercel.app` |

Ardından **Deployments → Redeploy** yap.

> Sadece kendin kullanacaksan, hesabını açtıktan sonra Neon Auth ayarlarından yeni kayıtları kapatabilirsin. Böylece başkası hesap açamaz.

### Yerelde çalıştırma
```bash
cp .env.example .env.local   # değerleri doldur (Vercel'dekilerle aynı)
npm install
npm run dev                  # http://localhost:3000
```
Yerelde `NEXT_PUBLIC_SITE_URL=http://localhost:3000` kullan ve `localhost`'u da Neon Auth'taki izinli alan adlarına ekle.

---

## Verilerin güvenliği
- **Kullanıcıya göre sınırlandırma:** Veritabanına yalnızca sunucu erişir. Her okuma ve yazma, oturumdaki kullanıcının kimliğiyle (`user_id`) sınırlandırılır; bu kimlik istemciden hiçbir zaman alınmaz. Tüm erişim iki dosyada toplanır: [src/lib/data.ts](src/lib/data.ts) ve [src/lib/actions/entries.ts](src/lib/actions/entries.ts).
- **Bileşik foreign key'ler:** Bir işlem, başka kullanıcının ya da yanlış türün (gelir/gider) kategorisine bağlanamaz. Bu kural veritabanı seviyesinde uygulanır.
- **Tutarlar kuruş cinsinden tam sayı** olarak tutulur, bu yüzden kayan nokta yuvarlama hatası olmaz.
- **Silinen kategori** kayıtları silmez; o kayıtlar "Kategorisiz" olarak kalır.
- **Yedek:** Ayarlar → *CSV indir* ile tüm kayıtlar Excel uyumlu bir dosyaya aktarılır. Neon ayrıca belirli bir ana geri dönmeyi (point-in-time restore) destekler.

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
db/schema.sql              Veritabanı: tablolar, kısıtlar, tetikleyiciler, fonksiyonlar
src/proxy.ts               Oturum yenileme ve korumalı rotalar (Neon Auth)
src/lib/auth.ts            Neon Auth örneği ve oturum yardımcıları
src/lib/db.ts              Neon sürücüsü
src/lib/data.ts            Okumalar (kullanıcıya göre sınırlı)
src/lib/actions/           Yazma işlemleri ve giriş/kayıt aksiyonları
src/components/ledger/     Defter ekranı (barkod, dağılım, trend, liste)
src/components/tx-sheet    Hızlı giriş çekmecesi
src/app/(app)/             Oturum gerektiren sayfalar
```
