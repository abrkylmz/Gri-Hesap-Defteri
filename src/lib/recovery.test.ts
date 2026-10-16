import { describe, expect, it } from "vitest";
import { hashRecoveryCode, newRecoveryCode, recoveryMatches } from "./recovery";

describe("kurtarma kodu", () => {
  it("biçim: 4×4, karışan harf yok", () => {
    const c = newRecoveryCode();
    expect(c).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(c).not.toMatch(/[01OIL]/);
  });
  it("her seferinde farklı", () => {
    expect(new Set(Array.from({ length: 50 }, newRecoveryCode)).size).toBe(50);
  });
  it("boşluk, tire ve küçük harf fark etmez", () => {
    const c = "ABCD-EFGH-JKMN-PQRS";
    const h = hashRecoveryCode(c);
    expect(recoveryMatches("abcd efgh jkmn pqrs", h)).toBe(true);
    expect(recoveryMatches("ABCDEFGHJKMNPQRS", h)).toBe(true);
    expect(recoveryMatches("ABCD-EFGH-JKMN-PQRT", h)).toBe(false);
    expect(recoveryMatches(c, null)).toBe(false);
  });
});
