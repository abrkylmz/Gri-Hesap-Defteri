"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import { dbError, fail, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";

// Fon getiri takibi yalnızca yöneticiye açık; veriler yöneticinin kendi hesabına aittir.
const MAX_FUNDS = 50;
const minor = z.number().int().min(0).max(99_999_999_999);

async function mutate(run: (uid: string) => Promise<unknown[]>): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
  if (user.role !== "admin") return fail("Bu bölüm yalnızca yöneticiye açık.");
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  try {
    if ((await run(user.userId)).length === 0) return NOT_FOUND;
  } catch (e) {
    if (isDbError(e) && e.code === "23505") return fail("Bu adla bir fon zaten var.");
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/fonlar");
  return OK;
}

const fundInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Fonun adını yaz.").max(60, "Ad en fazla 60 karakter."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((s) => s || null)
    .pipe(
      z
        .string()
        .regex(/^[A-Z0-9]{2,12}$/, "Fon kodu 2–12 harf/rakam olmalı (ör. AFT).")
        .nullable(),
    ),
  invested: minor,
});

/** Fon ekler ya da günceller (ad, kod, yatırılan toplam). */
export async function saveFund(input: unknown): Promise<ActionResult> {
  const parsed = fundInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Geçersiz.");
  const { id, name, code, invested } = parsed.data;
  const sql = db();
  return mutate((uid) =>
    id
      ? sql`update funds set name = ${name}, code = ${code}, invested = ${invested}
             where id = ${id} and user_id = ${uid} returning id`
      : sql`insert into funds (user_id, name, code, invested, sort)
            select ${uid}, ${name}, ${code}, ${invested}, coalesce(max(sort), 0) + 1
              from funds where user_id = ${uid}
            having count(*) < ${MAX_FUNDS}
            returning id`,
  ).then((r) => (!id && r === NOT_FOUND ? fail(`En fazla ${MAX_FUNDS} fon ekleyebilirsin.`) : r));
}

export async function deleteFund(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from funds where id = ${id} and user_id = ${uid} returning id`);
}

const valueInput = z.object({ fundId: z.uuid(), day: z.iso.date(), value: minor });

/** Günün değerini kaydeder (aynı gün yeniden girilirse günceller). */
export async function saveFundValue(input: unknown): Promise<ActionResult> {
  const parsed = valueInput.safeParse(input);
  if (!parsed.success) return fail("Geçerli bir tarih ve tutar gir.");
  const { fundId, day, value } = parsed.data;
  return mutate(
    (uid) => db()`
    insert into fund_values (fund_id, day, value)
    select id, ${day}::date, ${value} from funds where id = ${fundId} and user_id = ${uid}
    on conflict (fund_id, day) do update set value = excluded.value
    returning fund_id`,
  );
}

export async function deleteFundValue(fundId: string, day: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(fundId).success || !z.iso.date().safeParse(day).success) return NOT_FOUND;
  return mutate(
    (uid) => db()`
    delete from fund_values v using funds f
     where v.fund_id = f.id and f.user_id = ${uid} and v.fund_id = ${fundId} and v.day = ${day}::date
    returning v.fund_id`,
  );
}
