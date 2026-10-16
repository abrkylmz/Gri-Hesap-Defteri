import { createHash, randomInt, timingSafeEqual } from "node:crypto";

// Şifre kurtarma kodu: 16 karakter (≈80 bit), karışabilecek harfler (0/O, 1/I/L) yok.
// Veritabanında yalnızca SHA-256 özeti tutulur; kod bir kez kullanılınca silinir.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 16;

/** "ABCD-EFGH-JKMN-PQRS" biçiminde yeni kod. */
export function newRecoveryCode(): string {
  let s = "";
  for (let i = 0; i < LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s.match(/.{4}/g)!.join("-");
}

/** Kullanıcının yazdığı kodu karşılaştırılabilir hale getirir (boşluk/tire/küçük harf fark etmez). */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .slice(0, 64);
}

export const hashRecoveryCode = (code: string) =>
  createHash("sha256").update(`gri-recovery:${normalizeRecoveryCode(code)}`).digest("hex");

/** Sabit sürede karşılaştırma. */
export function recoveryMatches(code: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashRecoveryCode(code));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
