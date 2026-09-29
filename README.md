# Gri Hesap Defteri

Aylık gelir ve giderleri tutmak için kişisel bir hesap defteri. Veriler bulutta saklanır; aynı hesapla hangi cihazdan girersen gir aynı defteri görürsün. iPhone ve Android'de "Ana Ekrana Ekle" ile uygulama gibi çalışır, internet yokken de açılır.

## Neler yapabilirsin?

- **Gelir ve gider kaydı:** Hızlı tuş takımıyla saniyeler içinde kayıt. İstersen dolar, euro ya da sterlinle girersin; TL karşılığı günün kuruyla hesaplanır.
- **Aylık özet:** Net durum, kategorilere göre dağılım, bütçe takibi ve son altı ayın gidişatı.
- **Düzenli ödemeler ve şablonlar:** Kira, maaş, abonelik gibi kalemler her ay kendiliğinden deftere yazılır. Bir ayın düzenini şablon yapıp sonraki aylara tek dokunuşla uygularsın.
- **Hatırlatmalar:** Yaklaşan ödemeler için telefona bildirim gelir. Ödenenler ✓ ile işaretlenir.
- **Kredi takibi:** Çekilen kredinin taksitleri aylara otomatik bölünür; ayrıca bir kredi hesaplayıcı da var.
- **Döviz ve altın:** Güncel kurlar ve birikimlerinin TL değeri defterin en üstünde.
- **Halka arz takibi:** Birden çok hesaptan katılım, satış ve kâr/zarar hesabı.
- **Rapor ve içe aktarma:** Aylık raporu PDF olarak kaydedebilir, bankadan indirdiğin ekstreyi (CSV/Excel) deftere aktarabilirsin.
- **Paylaşım:** Defterini davet ettiğin kişiyle birlikte kullanabilirsin.

## Kullanılan teknolojiler

- **Next.js 16** (App Router, Server Actions)
- **React 19** ve **TypeScript**
- **Tailwind CSS 4**
- **Neon Postgres** (sunucusuz PostgreSQL)
- **Zod** (veri doğrulama)
- **Web Push** ve **Service Worker** (bildirimler, çevrimdışı kullanım)
- **Vitest** (testler)
- **Vercel** (yayın ve zamanlanmış görevler)
