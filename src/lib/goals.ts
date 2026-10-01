// Finansal hedefler: istemci ve sunucu ortak tanımlar ve hesaplar.

export type Goal = {
  id: string;
  name: string;
  /** İkon anahtarı (category-icon.tsx) */
  icon: string;
  /** Kuruş */
  target: number;
  saved: number;
  /** Hedef tarih (YYYY-MM-DD) ya da null */
  due: string | null;
};

/** Hedeflerde önerilen ikonlar */
export const GOAL_ICONS = ["piggy", "car", "home", "plane", "holiday", "school", "laptop", "phone", "baby", "gift", "health", "invest"] as const;

export const goalProgress = (g: Goal) => Math.min(1, g.target > 0 ? g.saved / g.target : 0);

/** Hedef tarihe kadar kalan ay sayısı (bu ay dahil, en az 1); tarih yoksa null */
export function monthsLeft(due: string | null, today: string): number | null {
  if (!due) return null;
  const [ty, tm] = today.split("-").map(Number) as [number, number];
  const [dy, dm] = due.split("-").map(Number) as [number, number];
  return Math.max(1, (dy - ty) * 12 + (dm - tm) + 1);
}

/**
 * Hedefe yetişmek için ayda biriktirilmesi gereken (kuruş, yukarı yuvarlanır).
 * Tamamlanmışsa 0; tarih yoksa ya da geçmişse null.
 */
export function monthlyNeeded(g: Goal, today: string): number | null {
  const left = g.target - g.saved;
  if (left <= 0) return 0;
  if (!g.due || g.due < today) return null;
  return Math.ceil(left / monthsLeft(g.due, today)!);
}
