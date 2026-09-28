# Gri Hesap Defteri

Aylık gelir ve giderleri tutmak için kişisel bir defter. Veriler Neon (Postgres) üzerinde saklanır. Aynı hesapla hangi cihazdan girersen gir aynı defteri görürsün. iPhone ve Android'de "Ana Ekrana Ekle" ile uygulama gibi çalışır (PWA).

**Teknoloji:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Neon Postgres · Zod · Vitest

---

## Kurulum (bir kez)

1. **Vercel projesi:** [vercel.com/new](https://vercel.com/new) adresinden bu GitHub deposunu içe aktar.
2. **Neon veritabanı:** Vercel → projen → **Storage → Neon** ile bir veritabanı oluştur ve **Connect Project** ile bağla. Pencerede şu ayarları kullan:
   - Environments: **All Environments**
   - "Create Database Branch" kutuları: **işaretsiz**
   - Prefix: **boş**

   Bu adım `DATABASE_URL` değişkenini otomatik ekler.
3. **Tablolar:** **Open in Neon → SQL Editor**'da [`db/schema.sql`](db/schema.sql) dosyasının tamamını çalıştır. Betik tekrar çalıştırılabilir; mevcut verileri silmez.
4. **Redeploy:** Vercel → **Deployments → ⋯ → Redeploy**.
5. Siteyi aç ve **kullanıcı adı + şifre** belirle. İlk oluşturulan hesap defterin sahibidir; ardından kayıt ekranı kendiliğinden kapanır.

Bir adım eksikse site, neyin eksik olduğunu gösteren `/kurulum` sayfasına yönlendirir.

> Ailenden birinin de ayrı defter açmasını istersen Vercel'e `ALLOW_SIGNUP=true` ekleyip yeniden deploy et. Her kullanıcı yalnızca kendi defterini görür.

### Ödeme hatırlatmaları (isteğe bağlı)
Yaklaşan ödemeler hem defterin üstünde bir şeritte görünür hem de her sabah 09:00'da (Türkiye saati) telefona bildirim olarak gelir. Bildirimler için Vercel'e üç değişken ekle ve yeniden deploy et:

| Değişken | Nasıl üretilir |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` (Public Key) |
| `VAPID_PRIVATE_KEY` | aynı komut (Private Key) |
| `CRON_SECRET` | `openssl rand -base64 32` |

Ardından her cihazda **Ayarlar → Bildirimleri aç**. iPhone'da bildirimler, yalnızca uygulama **Ana Ekrana eklenip oradan açıldığında** çalışır (iOS 16.4+). Her kayıtta "Hatırlat" ile kaç gün önce hatırlatılacağını seçebilirsin; düzenli giderler için varsayılan 3 gündür. Aynı ödeme için aynı vadede yalnızca bir bildirim gönderilir.

### Şifreni unutursan
E-posta kullanılmadığı için sıfırlama bağlantısı yok. Giriş yapabiliyorsan şifreni **Ayarlar → Şifreyi değiştir** ile değiştirebilirsin. Şifreni tamamen unuttuysan yeni şifrenin özeti SQL Editor'dan `users` tablosuna yazılarak sıfırlanabilir; bunun için bir geliştiriciden yardım al.

### Yerelde çalıştırma
```bash
cp .env.example .env.local   # DATABASE_URL'yi doldur
npm install
npm run dev                  # http://localhost:3000
```

---

## Güvenlik
- **Giriş:** Şifreler scrypt ile tuzlanıp özetlenerek saklanır. Oturum çerezi `httpOnly` ve `secure`'dur; veritabanında belirtecin kendisi değil, yalnızca SHA-256 özeti tutulur. Oturum 180 gün açık kalır. 15 dakikada 10 hatalı denemeden sonra o kullanıcı adıyla giriş geçici olarak kilitlenir. Şifre değiştirilince diğer cihazlardaki oturumlar kapanır.
- **Kullanıcıya göre sınırlandırma:** Veritabanına yalnızca sunucu erişir. Her okuma ve yazma, oturumdaki kullanıcının kimliğiyle sınırlandırılır; bu kimlik istemciden hiçbir zaman alınmaz. Veri erişiminin tamamı iki dosyada toplanır: [src/lib/data.ts](src/lib/data.ts) ve [src/lib/actions/entries.ts](src/lib/actions/entries.ts).
- **Bileşik foreign key'ler:** Bir işlem, başka kullanıcının ya da yanlış türün (gelir/gider) kategorisine bağlanamaz. Bu kural veritabanı seviyesinde uygulanır.
- **Tutarlar kuruş cinsinden tam sayı** olarak tutulur, bu yüzden kayan nokta yuvarlama hatası olmaz.
- **Silinen kategori** kayıtları silmez; o kayıtlar "Kategorisiz" olarak kalır.
- **Yedek:** Ayarlar → *CSV indir* ile tüm kayıtlar Excel uyumlu bir dosyaya aktarılır. Neon ayrıca belirli bir ana geri dönmeyi (point-in-time restore) destekler.

## Özellikler
- **Ayın barkodu:** Her gün bir çizgidir. Çizginin boyu o günün giderini gösterir, yeşil çentik gelir girişini işaretler. Bir çizgiye dokununca defter o güne göre filtrelenir.
- **Hızlı giriş:** Özel tuş takımı var; masaüstünde klavyeyle de kullanılır (`N` yeni kayıt açar, `Enter` kaydeder). Son kullanılan kategori hatırlanır. Geri silme tuşuna basılı tutunca tutar temizlenir.
- **Düzenli kayıtlar:** Kira, maaş ve abonelikler her ayın ilgili gününde deftere otomatik yazılır. İşlem idempotent'tir: iki cihazdan aynı anda açılsa bile tekrar yazılmaz, sildiğin bir kayıt da geri gelmez.
- **Bütçe cetvelleri:** Gider kategorilerine aylık bütçe konabilir; bütçe aşılınca cetvel turuncuya döner.
- Tempo tahmini, geçen ayla karşılaştırma, 6 aylık trend, ay sonu beklenen net, arama ve filtreler.
- Açık/koyu tema (sistemi izler), Türkçe biçimlendirme; TRY, USD, EUR ve GBP para birimleri.

## Komutlar
| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm test` | Birim testleri (para, tarih, özet, tuş takımı, şifre) |
| `npm run lint` / `npm run typecheck` | Kod kalitesi |

## Proje yapısı
```
db/schema.sql              Veritabanı: tablolar, kısıtlar, tetikleyiciler, fonksiyonlar
src/proxy.ts               Korumalı rotalar ve kurulum yönlendirmesi
src/lib/auth.ts            Oturum açma, kapama ve doğrulama
src/lib/password.ts        scrypt şifre özetleme, oturum belirteçleri
src/lib/db.ts              Neon sürücüsü
src/lib/data.ts            Okumalar (kullanıcıya göre sınırlı)
src/lib/actions/           Yazma işlemleri ve giriş/kayıt aksiyonları
src/components/ledger/     Defter ekranı (barkod, dağılım, trend, liste)
src/components/tx-sheet    Hızlı giriş çekmecesi
src/app/(app)/             Oturum gerektiren sayfalar
```
