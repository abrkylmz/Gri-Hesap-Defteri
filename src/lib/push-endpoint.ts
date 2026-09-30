/**
 * Bildirim, sunucudan abonelik adresine POST edilerek gönderilir. Yalnızca tarayıcıların gerçek
 * push servislerine izin verilir; aksi halde sunucu, kullanıcının yazdığı herhangi bir adrese
 * (iç ağ, bulut meta veri servisi…) istek atmaya zorlanabilirdi (SSRF).
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Samsung Internet, Opera
  /^android\.googleapis\.com$/, // eski Chrome abonelikleri
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari (iOS / macOS)
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Windows / Edge
];

export function isPushEndpoint(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      u.port === "" &&
      u.username === "" &&
      u.password === "" &&
      PUSH_HOSTS.some((re) => re.test(u.hostname))
    );
  } catch {
    return false;
  }
}
