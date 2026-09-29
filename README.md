# Gri Hesap Defteri

Aylık gelir ve giderleri tutmak için kişisel bir defter. Veriler Neon (Postgres) üzerinde saklanır. Aynı hesapla hangi cihazdan girersen gir aynı defteri görürsün. iPhone ve Android'de "Ana Ekrana Ekle" ile uygulama gibi çalışır (PWA).

**Teknoloji:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Neon Postgres · Zod · Vitest

---



### Güncellemeler kendiliğinden yayına çıkar
GitHub'a gönderilen her değişiklikte Vercel yeniden deploy eder. Build sırasında [`scripts/migrate.mjs`](scripts/migrate.mjs), [`db/schema.sql`](db/schema.sql) dosyasını veritabanına uygular; bu yüzden yeni tablo ya da sütun gerektiren güncellemelerde de elle bir şey yapmak gerekmez. Şema tekrar çalıştırılabilir ve veri silmez. Şema uygulanamazsa build durur; böylece yeni kod eski veritabanıyla yayına çıkmaz.


### Ödeme hatırlatmaları
Yaklaşan ödemeler hem defterin üstünde bir şeritte görünür hem de her sabah 09:00 civarında (Türkiye saati) telefona bildirim olarak gelir. Ek kurulum gerekmez: bildirim anahtarları ilk kullanımda otomatik üretilir. Her cihazda **Ayarlar → Bildirimleri aç** demen yeterli.

- **iPhone:** Bildirimler yalnızca uygulama **Ana Ekrana eklenip oradan açıldığında** çalışır (iOS 16.4+).
- **Ne zaman:** Gider girerken **🔔 Hatırlat** düğmesiyle ödeme tarihini ve kaç gün önce hatırlatılacağını seçersin. Defterde bir harcamayı sola kaydırıp (masaüstünde üzerine gelip) **Hatırlat** diyerek de açabilirsin. Hatırlatması olan harcamalar listede zil işaretiyle görünür. Düzenli giderler için varsayılan 3 gündür.
- **Tekrar yok:** Aynı ödeme için aynı vadede yalnızca bir bildirim gönderilir.

### Defteri paylaşma
**Ayarlar → Paylaşım**'da bir kullanıcının adını yazıp defterine davet edersin. Davetli, sayfanın üstünde çıkan daveti kabul edince gelir-giderlerini, kategorilerini ve düzenli kayıtlarını görüp düzenleyebilir. Birden çok deftere erişen kullanıcı, sayfanın üstündeki seçiciyle defterler arasında geçer; başkasının defterindeyken bu hep görünür.
- Erişim her istekte veritabanından doğrulanır; davet geri çekildiği, kişi ayrıldığı ya da hesap devre dışı kaldığı an erişim biter.
- Paylaşım tek yönlüdür: davet eden, davetlinin defterini görmez.
- Paylaşılan defterin ödeme hatırlatmaları hem sahibine hem de üyelere gider.
- Halka arz portföyü, para birimi ve saat dilimi kişiseldir; paylaşılmaz.

### Halka arz takibi
Menüdeki **Halka Arz** bölümünde, birden çok aracı kurum/kişi hesabından yaptığın halka arz katılımlarını izlersin:
- **Hesaplar:** Katılım yaptığın hesaplar (ör. "Ahmet · Garanti", "Eşim · Ziraat").
- **Halka arz:** Hisse kodu, arz fiyatı ve her hesaba kaç lot geldiği tek formda girilir.
- **Satış:** Her hesap için parça parça satış (lot, fiyat, tarih, isteğe bağlı komisyon) girilir. Satılan lot hiçbir zaman gelen lotu aşamaz; bu kural veritabanında da denetlenir.
- **Hesaplananlar:** Maliyet, gerçekleşen kâr/zarar, eldeki lotların güncel değeri, açık pozisyon kâr/zararı ve getiri %. Bunlar hisse, hesap ve toplam portföy düzeyinde gösterilir. Bir hesap kartına dokununca ekran o hesaba göre süzülür.
- **Güncel fiyat:** Otomatik çekilmez; hisse kartındaki "Güncel" etiketine dokunup girilir. Girilmemişse eldeki lotlar arz fiyatından değerlenir.

### Yönetim paneli
İlk açılan hesap **yönetici** olur. Yönetici, masaüstünde yan menüden, telefonda **Ayarlar → Yönetim paneli**'nden şunları yapabilir:
- Yeni kayıtları açmak ya da kapatmak (varsayılan: açık)
- Kullanıcıları görmek: katılma tarihi, son görülme, kayıt sayısı, bildirimli cihaz sayısı
- Bir kullanıcının şifresini sıfırlamak (tek seferlik gösterilen geçici şifre üretilir)
- Hesabı devre dışı bırakmak ya da etkinleştirmek, başka birini yönetici yapmak
- Hesabı ve tüm verisini kalıcı olarak silmek

Gizlilik gereği panelde kullanıcıların tutarları ve açıklamaları **gösterilmez**; yalnızca kayıt sayıları görünür. Yönetici kendi hesabında yıkıcı işlem yapamaz; böylece yanlışlıkla kendini kilitleyemez.

### Şifreni unutursan
E-posta kullanılmadığı için sıfırlama bağlantısı yok. Giriş yapabiliyorsan şifreni **Ayarlar → Şifreyi değiştir** ile değiştirebilirsin. Giriş yapamıyorsan yönetici, **Yönetim paneli**'nden senin için geçici bir şifre üretebilir.

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
