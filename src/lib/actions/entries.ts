"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import {
  categoryInput,
  profileInput,
  recurringInput,
  transactionInput,
  type CategoryInput,
  type RecurringInput,
  type TransactionInput,
} from "@/lib/validation";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { isValidTimeZone } from "@/lib/dates";

const idSchema = z.uuid();
const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");

/**
 * Ortak akış: oturumu doğrula, sorguyu çalıştır, etkilenen satır yoksa "bulunamadı" de,
 * başarıda tüm sayfaları tazele. Her sorgu `user_id` ile sınırlandırılır.
 */
async function mutate(run: (userId: string) => Promise<unknown[]>): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  try {
    const rows = await run(user.userId);
    if (rows.length === 0) return NOT_FOUND;
  } catch (e) {
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/", "layout");
  return OK;
}

// ─── İşlemler ───────────────────────────────────────────────────────────

export async function saveTransaction(input: TransactionInput): Promise<ActionResult> {
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, kind, amount, categoryId, note, occurredOn } = parsed.data;
  // Hatırlatma yalnızca giderler için anlamlı.
  const remind = kind === "expense" ? parsed.data.remindDays : null;
  const sql = db();

  return mutate((uid) =>
    id
      ? sql`update transactions
              set kind = ${kind}, amount = ${amount}, category_id = ${categoryId},
                  note = ${note}, occurred_on = ${occurredOn}, remind_days = ${remind}
            where id = ${id} and user_id = ${uid} returning id`
      : sql`insert into transactions (user_id, kind, amount, category_id, note, occurred_on, remind_days)
            values (${uid}, ${kind}, ${amount}, ${categoryId}, ${note}, ${occurredOn}, ${remind})
            returning id`,
  );
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from transactions where id = ${id} and user_id = ${uid} returning id`);
}

const restoreInput = z.object({
  id: z.uuid(),
  kind: z.enum(["income", "expense"]),
  amount: z.number().int().positive(),
  category_id: z.uuid().nullable(),
  note: z.string().max(200).nullable(),
  occurred_on: z.iso.date(),
  recurring_id: z.uuid().nullable(),
  remind_days: z.number().int().min(0).max(30).nullable(),
  created_at: z.string().max(64),
});

/**
 * "Geri al": silinen kaydı aynı id, oluşturulma zamanı ve düzenli kayıt bağıyla geri yükler.
 * Bu arada kategorisi ya da düzenli kaydı silinmişse o bağlar boş bırakılır.
 */
export async function restoreTransaction(input: unknown): Promise<ActionResult> {
  const parsed = restoreInput.safeParse(input);
  if (!parsed.success) return fail("Kayıt geri alınamadı.");
  const t = parsed.data;
  // Postgres'in kendi zaman damgası biçimi ("2026-09-29 01:52:00.123+00") olduğu gibi geri yazılır;
  // tanınmayan bir değer gelirse şimdiki zaman kullanılır.
  const createdAt = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?|Z)?$/.test(t.created_at)
    ? t.created_at
    : new Date().toISOString();

  return mutate(
    (uid) => db()`
      insert into transactions (id, user_id, kind, amount, category_id, note, occurred_on, recurring_id, remind_days, created_at)
      values (
        ${t.id}, ${uid}, ${t.kind}, ${t.amount},
        (select id from categories where id = ${t.category_id} and user_id = ${uid} and kind = ${t.kind}),
        ${t.note}, ${t.occurred_on},
        (select id from recurring where id = ${t.recurring_id} and user_id = ${uid}),
        ${t.remind_days}, ${createdAt}
      )
      on conflict (id) do nothing
      returning id`,
  );
}

// ─── Kategoriler ────────────────────────────────────────────────────────

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, kind, name, emoji, monthlyBudget } = parsed.data;
  const budget = kind === "expense" ? monthlyBudget : null;
  const sql = db();

  // Tür (gelir/gider) sonradan değiştirilemez: bağlı işlemlerin tutarlılığı için.
  return mutate((uid) =>
    id
      ? sql`update categories set name = ${name}, emoji = ${emoji}, monthly_budget = ${budget}
            where id = ${id} and user_id = ${uid} returning id`
      : sql`insert into categories (user_id, kind, name, emoji, monthly_budget, sort)
            values (${uid}, ${kind}, ${name}, ${emoji}, ${budget}, 50) returning id`,
  );
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from categories where id = ${id} and user_id = ${uid} returning id`);
}

// ─── Düzenli kayıtlar ───────────────────────────────────────────────────

export async function saveRecurring(input: RecurringInput): Promise<ActionResult> {
  const parsed = recurringInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, kind, amount, categoryId, note, dayOfMonth, startsOn, active } = parsed.data;
  const remind = kind === "expense" ? parsed.data.remindDays : null;
  const sql = db();

  return mutate((uid) =>
    id
      ? sql`update recurring
              set kind = ${kind}, amount = ${amount}, category_id = ${categoryId}, note = ${note},
                  day_of_month = ${dayOfMonth}, starts_on = ${startsOn}, active = ${active},
                  remind_days = ${remind}
            where id = ${id} and user_id = ${uid} returning id`
      : sql`insert into recurring
              (user_id, kind, amount, category_id, note, day_of_month, starts_on, active, remind_days)
            values (${uid}, ${kind}, ${amount}, ${categoryId}, ${note}, ${dayOfMonth}, ${startsOn},
                    ${active}, ${remind})
            returning id`,
  );
}

export async function setRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate(
    (uid) => db()`update recurring set active = ${Boolean(active)}
                  where id = ${id} and user_id = ${uid} returning id`,
  );
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from recurring where id = ${id} and user_id = ${uid} returning id`);
}

// ─── Profil ─────────────────────────────────────────────────────────────

export async function updateProfile(input: { currency: string; timezone: string }): Promise<ActionResult> {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return fail("Geçersiz ayar.");
  const { currency, timezone } = parsed.data;
  return mutate(
    (uid) => db()`update profiles set currency = ${currency}, timezone = ${timezone}
                  where user_id = ${uid} returning user_id`,
  );
}
