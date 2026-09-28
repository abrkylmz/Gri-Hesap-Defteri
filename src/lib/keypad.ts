import { groupDigits, MAX_INT_DIGITS } from "@/lib/money";

export type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "back";

export const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"];

/** Tuş takımı girdisini uygular: tek virgül, en fazla 2 ondalık, en fazla 9 tam hane. */
export function pressKey(current: string, key: Key): string {
  if (key === "back") return current.slice(0, -1);
  if (key === ",") return current.includes(",") ? current : `${current || "0"},`;
  const [int = "", frac] = current.split(",");
  if (frac !== undefined) return frac.length >= 2 ? current : current + key;
  if (int === "0") return key;
  if (int.length >= MAX_INT_DIGITS) return current;
  return current + key;
}

/** "1250,5" → { int: "1.250", frac: "5" } */
export function displayAmount(raw: string) {
  const [int = "", frac] = raw.split(",");
  return { int: groupDigits(int || "0"), frac };
}
