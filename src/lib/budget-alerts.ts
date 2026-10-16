import "server-only";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { sendToUser } from "@/lib/push";

/** Aylık bütçenin bu oranları ilk kez geçilince bir kez bildirim gider. */
export const BUDGET_LEVELS = [0.8, 1] as const;

/** Harcamanın ulaştığı en yüksek eşik (0,8 ya da 1); hiçbirine ulaşmadıysa null. Saf; test edilir. */
export function budgetLevel(spent: number, budget: number): 0.8 | 1 | null {
  if (budget <= 0) return null;
  const r = spent / budget;
  return r >= 1 ? 1 : r >= 0.8 ? 0.8 : null;
}

/**
 * Gider kaydedildikten sonra çağrılır: kaydın ayında kategori harcaması bir bütçe eşiğini ilk kez
 * geçtiyse defter sahibine ve defteri paylaşan üyelere bildirim gönderir. Yalnızca içinde bulunulan
 * ay için (geçmiş aylara girilen kayıtlar uyarı üretmez). Hata olursa sessizce loglanır.
 */
export async function checkBudgetAlert(ownerId: string, categoryId: string, occurredOn: string) {
  try {
    const sql = db();
    const month = occurredOn.slice(0, 7);
    const [row] = (await sql`
      select c.name, c.monthly_budget::float8 as budget,
             coalesce(p.timezone, 'Europe/Istanbul') as tz, coalesce(p.currency, 'TRY') as currency,
             to_char(now() at time zone coalesce(p.timezone, 'Europe/Istanbul'), 'YYYY-MM') as current_month,
             coalesce((select sum(t.amount) from transactions t
                        where t.user_id = ${ownerId} and t.kind = 'expense' and t.category_id = c.id
                          and t.amount is not null
                          and to_char(t.occurred_on, 'YYYY-MM') = ${month}), 0)::float8 as spent
        from categories c left join profiles p on p.user_id = c.user_id
       where c.id = ${categoryId} and c.user_id = ${ownerId} and c.kind = 'expense'`) as {
      name: string;
      budget: number | null;
      currency: string;
      current_month: string;
      spent: number;
    }[];
    if (!row || !row.budget || row.current_month !== month) return;
    const level = budgetLevel(row.spent, row.budget);
    if (level === null) return;

    // Aynı ay ve eşik için yalnızca bir kez (100'e doğrudan atlanırsa 80 de "gönderildi" sayılır).
    const keys = BUDGET_LEVELS.filter((l) => l <= level).map((l) => `budget:${categoryId}:${month}:${l * 100}`);
    const claimed = (await sql`
      insert into notices_sent (user_id, key) select ${ownerId}, k from unnest(${keys}::text[]) as k
      on conflict do nothing returning key`) as { key: string }[];
    if (!claimed.some((c) => c.key.endsWith(`:${level * 100}`))) return;

    const recipients = (await sql`
      select ${ownerId}::text as id
      union
      select member_id from ledger_members where owner_id = ${ownerId} and status = 'accepted'`) as { id: string }[];
    const pct = Math.round((row.spent / row.budget) * 100);
    const payload =
      level === 1
        ? {
            title: `${row.name} bütçesi aşıldı`,
            body: `Bu ay ${formatMoney(row.spent, row.currency)} harcandı; bütçe ${formatMoney(row.budget, row.currency)} (%${pct}).`,
          }
        : {
            title: `${row.name} bütçesinin %${pct}'i kullanıldı`,
            body: `Kalan: ${formatMoney(row.budget - row.spent, row.currency)} · ay sonuna dikkat.`,
          };
    await Promise.all(
      recipients.map((r) => sendToUser(r.id, { ...payload, url: "/kategoriler", tag: `budget-${categoryId}` })),
    );
  } catch (e) {
    console.error("[budget] uyarı", e);
  }
}
