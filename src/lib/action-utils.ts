import type { ZodError } from "zod";

export type ActionResult = { ok: true } | { ok: false; error: string };

export const OK: ActionResult = { ok: true };

export const fail = (error: string): ActionResult => ({ ok: false, error });

export const invalid = (e: ZodError): ActionResult =>
  fail(e.issues[0]?.message ?? "Girilen bilgiler geçersiz.");

export const NOT_FOUND = fail("Kayıt bulunamadı. Başka bir cihazdan silinmiş olabilir.");

export function dbError(error: { code?: string; message: string }): ActionResult {
  switch (error.code) {
    case "23505":
      return fail("Bu isimde bir kayıt zaten var.");
    case "23503":
      return fail("Seçilen kategori bulunamadı ya da türü uyuşmuyor.");
    case "23514":
    case "22P02":
      return fail("Girilen değer geçersiz.");
    case "42501":
    case "PGRST301":
    case "23502":
      return fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
    default:
      console.error("[db]", error);
      return fail("Bir şeyler ters gitti. Lütfen tekrar dene.");
  }
}
