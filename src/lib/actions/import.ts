"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, isDbError } from "@/lib/db";
import { actionScope } from "@/lib/scope";
import { dbError, fail, type ActionResult } from "@/lib/action-utils";
import { MAX_MINOR } from "@/lib/money";
import { dupKey, type History } from "@/lib/statement";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
const MAX_ROWS = 2000;

/**
 * İçe aktarma ön bilgisi: dosyanın tarih aralığında defterde zaten olan kayıtların anahtarları
 * (tekrarları işaretlemek için) ve kategori önerisi için geçmiş açıklamalar.
 */
export async function importContext(
  from: string,
  to: string,
): Promise<{ ok: true; existing: string[]; history: History } | { ok: false; error: string }> {
  const dates = z.object({ from: z.iso.date(), to: z.iso.date() }).safeParse({ from, to });
  if (!dates.success) return fail("Geçersiz tarih aralığı.") as { ok: false; error: string };
  const scope = await actionScope();
  if (!scope) return SESSION_EXPIRED as { ok: false; error: string };
  const sql = db();
  const [existing, history] = await Promise.all([
    sql`select occurred_on::text as d, amount::float8 as a, kind from transactions
        where user_id = ${scope.ownerId} and amount is not null
          and occurred_on between ${from}::date and ${to}::date`,
    sql`select note, category_id::text as "categoryId" from transactions
        where user_id = ${scope.ownerId} and note is not null and category_id is not null
        order by created_at desc limit 3000`,
  ]);
  return {
    ok: true,
    existing: (existing as { d: string; a: number; kind: "income" | "expense" }[]).map((r) => dupKey(r.d, r.a, r.kind)),
    history: history as History,
  };
}

const rowSchema = z.object({
  date: z.iso.date(),
  amount: z.number().int().positive().max(MAX_MINOR),
  kind: z.enum(["income", "expense"]),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((s) => s || null),
  categoryId: z.uuid().nullable(),
});

/** Seçilen ekstre satırlarını tek transaction'da deftere yazar. */
export async function importTransactions(input: unknown): Promise<ActionResult & { count?: number }> {
  const parsed = z.array(rowSchema).min(1, "İçe aktarılacak satır seç.").max(MAX_ROWS).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Satırlar geçersiz.");
  const scope = await actionScope();
  if (!scope) return SESSION_EXPIRED;
  if (!(await allow("import", scope.actor.userId))) return fail(RATE_LIMITED);
  const rows = parsed.data;
  const sql = db();
  try {
    // Kategori, satır bazında bu kullanıcıya ve türe aitse bağlanır; değilse kategorisiz kalır.
    await sql.transaction([
      sql`insert into transactions (user_id, kind, amount, category_id, note, occurred_on, paid_at)
          select ${scope.ownerId}, t.k::entry_kind, t.a,
                 (select c.id from categories c
                   where c.id = t.c and c.user_id = ${scope.ownerId} and c.kind = t.k::entry_kind),
                 t.n, t.d, now()
            from unnest(${rows.map((r) => r.kind)}::text[], ${rows.map((r) => r.amount)}::bigint[],
                        ${rows.map((r) => r.categoryId)}::uuid[], ${rows.map((r) => r.note)}::text[],
                        ${rows.map((r) => r.date)}::date[]) as t(k, a, c, n, d)`,
    ]);
  } catch (e) {
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/", "layout");
  return { ok: true, count: rows.length };
}
