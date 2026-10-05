# Gri Hesap Defteri — Expo deneme kabuğu

Canlı siteyi (https://grihesapdefteri.vercel.app) tam ekran bir WebView içinde açan küçük Expo uygulaması.
Ekranlar ve veriler sitedekiyle aynıdır; site güncellenince bu da güncellenir.

## Telefonda denemek (Expo Go)

1. Telefona **Expo Go** uygulamasını kur (App Store / Google Play).
2. Bilgisayarla telefon aynı Wi-Fi ağında olsun.
3. Bu klasörde:
   ```
   npm install
   npx expo start
   ```
4. Terminaldeki QR kodu okut: iPhone'da Kamera ile, Android'de Expo Go içinden.

## Kaldırmak

`mobile/` klasörünü sil; ardından kökteki `.vercelignore`, `tsconfig.json` ve `eslint.config.mjs`
içindeki `mobile` satırlarını çıkar. Sitenin kendisi bu klasöre bağlı değildir.
