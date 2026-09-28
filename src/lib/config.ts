// Proxy'nin de içe aktarabildiği, bağımlılıksız sabitler.

export const SESSION_COOKIE = "gri_session";

/** Eksik zorunlu ortam değişkenlerinin adları (değerleri asla döndürülmez). */
export function missingEnv(): string[] {
  return process.env.DATABASE_URL ? [] : ["DATABASE_URL"];
}

/** İlk kullanıcıdan sonra yeni kayıtlara izin verilsin mi (ALLOW_SIGNUP=true ile). */
export const allowMoreSignups = () => process.env.ALLOW_SIGNUP === "true";
