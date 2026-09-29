import { describe, expect, it } from "vitest";
import { parseQuantity, valueOf } from "@/lib/assets";

describe("miktar ayrıştırma", () => {
  it.each([
    ["12,5", 12.5],
    ["1.500", 1500],
    ["1.500,25", 1500.25],
    ["0.5", 0.5],
    ["3", 3],
    [" 2 500 ", 2500],
    ["0,0001", 0.0001],
  ])("%s → %d", (s, n) => expect(parseQuantity(s)).toBe(n));

  it.each(["", "0", "abc", "1,2,3", "0,00001", "-5", "1.50"])("reddeder: %s", (s) => {
    // "1.50" belirsiz değil: 1,5 olarak okunur
    if (s === "1.50") expect(parseQuantity(s)).toBe(1.5);
    else expect(parseQuantity(s)).toBeNull();
  });

  it("TL değeri kuruş olarak yuvarlanır", () => {
    expect(valueOf(1500, 48.9889)).toBe(7348335);
    expect(valueOf(2.5, 6541.73)).toBe(1635433);
  });
});
