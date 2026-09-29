"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, isDbError } from "@/lib/db";
import { actionScope } from "@/lib/scope";
import { dbError, fail, invalid, NOT_FOUND, type ActionResult } from "@/lib/action-utils";
import { annuitySchedule, dueDates, fixedSchedule } from "@/lib/loan";
import { loanInput, type LoanInput } from "@/lib/validation";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");

/**
 * Krediyi kaydeder ve tüm taksitlerini, her ayın ilgili gününe ödenmemiş (○) gider olarak
 * deftere yazar. Plan sunucuda yeniden hesaplanır (istemciden gelen tutarlara güvenilmez).
 * Her şey tek transaction'da: yarım kredi oluşmaz.
 */
export async function createLoan(input: LoanInput): Promise<ActionResult & { count?: number }> {
  const parsed = loanInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const scope = await actionScope();
  if (!scope) return SESSION_EXPIRED;
  const uid = scope.ownerId;

  const schedule =
    d.installment !== null
      ? fixedSchedule(d.installment, d.termMonths, d.principal)
      : annuitySchedule(d.principal!, d.monthlyRate!, d.kkdf, d.bsmv, d.termMonths);
  const dates = dueDates(d.firstDue, d.termMonths);
  const amounts = schedule.rows.map((r) => r.payment);
  const nos = schedule.rows.map((r) => r.no);
  const loanId = randomUUID();
  const sql = db();

  try {
    await sql.transaction([
      sql`insert into categories (user_id, kind, name, emoji, sort)
          values (${uid}, 'expense', 'Kredi', '🏦', 11) on conflict (user_id, kind, name) do nothing`,
      sql`insert into loans (id, user_id, name, principal, monthly_rate, kkdf, bsmv, term_months, first_due)
          values (${loanId}, ${uid}, ${d.name}, ${d.principal}, ${d.installment !== null ? null : d.monthlyRate},
                  ${d.kkdf}, ${d.bsmv}, ${d.termMonths}, ${d.firstDue})`,
      sql`insert into transactions
            (user_id, kind, amount, category_id, note, occurred_on, remind_days, loan_id, installment_no)
          -- Seçilen kategori (bu kullanıcının bir gider kategorisiyse), yoksa "Kredi".
          select ${uid}, 'expense', t.a,
                 coalesce(
                   (select id from categories where id = ${d.categoryId}::uuid and user_id = ${uid} and kind = 'expense'),
                   (select id from categories where user_id = ${uid} and kind = 'expense' and name = 'Kredi')
                 ),
                 ${d.name} || ' · ' || t.n || '/' || ${d.termMonths}, t.d, ${d.remindDays}, ${loanId}, t.n
            from unnest(${amounts}::bigint[], ${dates}::date[], ${nos}::int[]) as t(a, d, n)`,
      ...(d.incomeOn !== null
        ? [
            sql`insert into categories (user_id, kind, name, emoji, sort)
                values (${uid}, 'income', 'Kredi', '🏦', 11) on conflict (user_id, kind, name) do nothing`,
            sql`insert into transactions (user_id, kind, amount, category_id, note, occurred_on, loan_id)
                values (${uid}, 'income', ${d.principal},
                        (select id from categories where user_id = ${uid} and kind = 'income' and name = 'Kredi'),
                        ${d.name} || ' · çekilen tutar', ${d.incomeOn}, ${loanId})`,
          ]
        : []),
    ]);
  } catch (e) {
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/", "layout");
  return { ok: true, count: d.termMonths };
}

/** Krediyi siler: ödenmemiş taksitler de silinir, ödenmiş taksitler defterde kalır. */
export async function deleteLoan(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  const scope = await actionScope();
  if (!scope) return SESSION_EXPIRED;
  const uid = scope.ownerId;
  const sql = db();
  try {
    const [, deleted] = await sql.transaction([
      sql`delete from transactions where loan_id = ${id} and user_id = ${uid} and paid_at is null and kind = 'expense'`,
      sql`delete from loans where id = ${id} and user_id = ${uid} returning id`,
    ]);
    if (!deleted || deleted.length === 0) return NOT_FOUND;
  } catch (e) {
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
