"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionScope } from "@/lib/scope";
import { db, isDbError } from "@/lib/db";
import {
  applyTemplateInput,
  categoryInput,
  profileInput,
  recurringInput,
  templateInput,
  transactionInput,
  type ApplyTemplateInput,
  type CategoryInput,
  type RecurringInput,
  type TemplateInput,
  type TransactionInput,
} from "@/lib/validation";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { dateInMonth, isValidTimeZone } from "@/lib/dates";

const idSchema = z.uuid();
const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");

/**
 * Ortak akış: oturumu ve defter yetkisini doğrula, sorguyu çalıştır, etkilenen satır yoksa
 * "bulunamadı" de, başarıda tüm sayfaları tazele.
 * `run`a verilen kimlik SEÇİLİ DEFTERİN sahibidir (kendi defterinde kullanıcının kendisi,
 * paylaşılan defterde kabul edilmiş üyelikle doğrulanmış sahip). Her sorgu bununla sınırlanır.
 */
async function mutate(
  run: (ownerId: string) => Promise<unknown[]>,
  target: "ledger" | "self" = "ledger",
): Promise<ActionResult> {
  const scope = await actionScope();
  if (!scope) return SESSION_EXPIRED;
  try {
    const rows = await run(target === "self" ? scope.actor.userId : scope.ownerId);
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
  const { id, newId, kind, categoryId, note, occurredOn, fx } = parsed.data;
  // Dövizli kayıtta TL tutarı her zaman döviz tutarı × kurdan hesaplanır (istemciye güvenilmez).
  const fxAmount = fx ? Math.round(fx.amount * 100) / 100 : null;
  const amount = fx ? Math.round(fxAmount! * fx.rate * 100) : parsed.data.amount;
  if (fx && (amount === null || amount < 1 || amount > 99_999_999_999)) return fail("Tutar geçerli aralıkta değil.");
  const fxCode = fx?.code ?? null;
  const fxRate = fx?.rate ?? null;
  // Hatırlatma yalnızca giderler için anlamlı.
  const remind = kind === "expense" ? parsed.data.remindDays : null;
  const sql = db();

  return mutate((uid) =>
    id
      ? sql`update transactions
              -- amount null gelirse mevcut tutar korunur: "tutar bekleniyor" kaydı boş kalır,
              -- tutarı belli bir kaydın tutarı boş gönderilerek silinemez.
              set kind = ${kind}, amount = coalesce(${amount}::bigint, amount), category_id = ${categoryId},
                  note = ${note}, occurred_on = ${occurredOn}, remind_days = ${remind},
                  fx_code = ${fxCode}, fx_amount = ${fxAmount}, fx_rate = ${fxRate}
            where id = ${id} and user_id = ${uid} returning id`
      : // Aynı newId ile ikinci gönderim yeni satır eklemez; ilk eklenen satır bulunup başarı sayılır.
        sql`with ins as (
              insert into transactions (id, user_id, kind, amount, category_id, note, occurred_on, remind_days,
                                        fx_code, fx_amount, fx_rate)
              values (coalesce(${newId ?? null}::uuid, gen_random_uuid()), ${uid}, ${kind}, ${amount}, ${categoryId},
                      ${note}, ${occurredOn}, ${remind}, ${fxCode}, ${fxAmount}, ${fxRate})
              on conflict (id) do nothing
              returning id
            )
            select id from ins
            union all
            select id from transactions where id = ${newId ?? null}::uuid and user_id = ${uid}`,
  );
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from transactions where id = ${id} and user_id = ${uid} returning id`);
}

const restoreInput = z.object({
  id: z.uuid(),
  kind: z.enum(["income", "expense"]),
  amount: z.number().int().positive().nullable(),
  category_id: z.uuid().nullable(),
  note: z.string().max(200).nullable(),
  occurred_on: z.iso.date(),
  recurring_id: z.uuid().nullable(),
  remind_days: z.number().int().min(0).max(30).nullable(),
  paid: z.boolean().default(false),
  template_id: z.uuid().nullable().default(null),
  loan_id: z.uuid().nullable().default(null),
  fx_code: z.enum(["USD", "EUR", "GBP"]).nullable().default(null),
  fx_amount: z.number().positive().nullable().default(null),
  fx_rate: z.number().positive().nullable().default(null),
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
  const fx = t.fx_code !== null && t.fx_amount !== null && t.fx_rate !== null;
  // Postgres'in kendi zaman damgası biçimi ("2026-09-29 01:52:00.123+00") olduğu gibi geri yazılır;
  // tanınmayan bir değer gelirse şimdiki zaman kullanılır.
  const createdAt = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?|Z)?$/.test(t.created_at)
    ? t.created_at
    : new Date().toISOString();

  return mutate(
    (uid) => db()`
      insert into transactions
        (id, user_id, kind, amount, category_id, note, occurred_on, recurring_id, remind_days, paid_at, template_id,
         loan_id, fx_code, fx_amount, fx_rate, created_at)
      values (
        ${t.id}, ${uid}, ${t.kind}, ${t.amount},
        (select id from categories where id = ${t.category_id} and user_id = ${uid} and kind = ${t.kind}),
        ${t.note}, ${t.occurred_on},
        (select id from recurring where id = ${t.recurring_id} and user_id = ${uid}),
        ${t.remind_days}, ${t.paid ? new Date().toISOString() : null},
        (select id from templates where id = ${t.template_id} and user_id = ${uid}),
        (select id from loans where id = ${t.loan_id} and user_id = ${uid}),
        ${fx ? t.fx_code : null}, ${fx ? t.fx_amount : null}, ${fx ? t.fx_rate : null},
        ${createdAt}
      )
      on conflict (id) do nothing
      returning id`,
  );
}

// ─── Ödendi (✓) ─────────────────────────────────────────────────────────

export async function setTransactionPaid(id: string, paid: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  const paidAt = paid ? new Date().toISOString() : null;
  let pendingAmount = false;
  const res = await mutate(async (uid) => {
    const sql = db();
    // Tutarı bekleyen kayıt "ödendi" işaretlenemez: önce tutar girilmeli.
    const rows = await sql`update transactions set paid_at = ${paidAt}
      where id = ${id} and user_id = ${uid} and (${!paid} or amount is not null) returning id`;
    if (rows.length === 0 && paid) {
      pendingAmount = (await sql`select 1 from transactions where id = ${id} and user_id = ${uid} and amount is null`).length > 0;
    }
    return rows;
  });
  return pendingAmount ? fail("Önce bu ödemenin tutarını gir, sonra ✓ ile işaretle.") : res;
}

/** Düzenli ödemeyi vadesinden önce öde: o dönemin kaydı bugünün tarihiyle, ödendi olarak yazılır. */
export async function payRecurringNow(recurringId: string, due: string): Promise<ActionResult> {
  if (!idSchema.safeParse(recurringId).success || !z.iso.date().safeParse(due).success) return NOT_FOUND;
  return mutate(async (uid) => {
    const [row] = (await db()`select pay_recurring_now(${uid}, ${recurringId}, ${due}::date) as ok`) as {
      ok: boolean;
    }[];
    // false: bu dönem zaten işlenmiş (ör. başka cihazdan) → kullanıcıya "bulunamadı" demek yerine başarılı say.
    return row ? [row] : [];
  });
}

// ─── Şablonlar ──────────────────────────────────────────────────────────

export async function saveTemplate(input: TemplateInput): Promise<ActionResult> {
  const parsed = templateInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, items } = parsed.data;

  return mutate(async (uid) => {
    const sql = db();
    const id = parsed.data.id ?? randomUUID();
    if (parsed.data.id) {
      const exists = await sql`select 1 from templates where id = ${id} and user_id = ${uid}`;
      if (exists.length === 0) return [];
    }
    // Satırlar tamamen yenilenir; hepsi tek transaction'da (yarım kalmaz).
    await sql.transaction([
      parsed.data.id
        ? sql`update templates set name = ${name} where id = ${id} and user_id = ${uid}`
        : sql`insert into templates (id, user_id, name) values (${id}, ${uid}, ${name})`,
      sql`delete from template_items where template_id = ${id} and user_id = ${uid}`,
      ...items.map(
        (it, i) => sql`insert into template_items
          (user_id, template_id, kind, amount, category_id, note, day_of_month, sort)
          values (${uid}, ${id}, ${it.kind}, ${it.amount}, ${it.categoryId}, ${it.note}, ${it.dayOfMonth}, ${i})`,
      ),
    ]);
    return [id];
  });
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from templates where id = ${id} and user_id = ${uid} returning id`);
}

/** Şablonun seçilen satırlarını verilen aya ödenmemiş (○) kayıtlar olarak yazar. */
export async function applyTemplate(input: ApplyTemplateInput): Promise<ActionResult> {
  const parsed = applyTemplateInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { templateId, month, items } = parsed.data;

  return mutate(async (uid) => {
    const sql = db();
    const rows = (await sql`select id, kind, category_id, note, day_of_month from template_items
      where template_id = ${templateId} and user_id = ${uid}`) as {
      id: string;
      kind: "income" | "expense";
      category_id: string | null;
      note: string | null;
      day_of_month: number;
    }[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const chosen = items.flatMap((sel) => {
      const it = byId.get(sel.itemId);
      return it ? [{ ...it, amount: sel.amount }] : [];
    });
    if (chosen.length === 0) return [];

    await sql.transaction(
      chosen.map(
        (it) => sql`insert into transactions
          (user_id, kind, amount, category_id, note, occurred_on, template_id)
          values (${uid}, ${it.kind}, ${it.amount}, ${it.category_id}, ${it.note},
                  ${dateInMonth(month, it.day_of_month)}, ${templateId})`,
      ),
    );
    return chosen;
  });
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
  // Profil (para birimi, saat dilimi) kişiseldir: paylaşılan defterdeyken bile kendi profilini günceller.
  return mutate(
    (uid) => db()`update profiles set currency = ${currency}, timezone = ${timezone}
                  where user_id = ${uid} returning user_id`,
    "self",
  );
}
