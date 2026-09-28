import { describe, expect, it } from "vitest";
import {
  DUMMY_HASH,
  hashPassword,
  hashToken,
  newSessionToken,
  normalizeUsername,
  USERNAME_RE,
  verifyPassword,
} from "@/lib/password";

describe("şifre özetleme", () => {
  it("doğru şifreyi kabul eder, yanlışı reddeder", async () => {
    const hash = await hashPassword("gizli-şifre-123");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("gizli-şifre-123", hash)).toBe(true);
    expect(await verifyPassword("gizli-şifre-124", hash)).toBe(false);
  });

  it("aynı şifre için her seferinde farklı tuz", async () => {
    expect(await hashPassword("abcdefgh")).not.toBe(await hashPassword("abcdefgh"));
  });

  it("bozuk ya da sahte özet her zaman false döner", async () => {
    expect(await verifyPassword("x", "bozuk")).toBe(false);
    expect(await verifyPassword("x", DUMMY_HASH)).toBe(false);
  });
});

describe("oturum belirteci ve kullanıcı adı", () => {
  it("belirteç rastgele, özeti deterministik", () => {
    const a = newSessionToken();
    expect(a).not.toBe(newSessionToken());
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("kullanıcı adı kuralları", () => {
    expect(normalizeUsername("  Ahmet ")).toBe("ahmet");
    expect(USERNAME_RE.test("ahmet.b_1-x")).toBe(true);
    for (const bad of ["ab", "ahmet b", "ahmetşimşek", "a".repeat(33)]) {
      expect(USERNAME_RE.test(bad)).toBe(false);
    }
  });
});
