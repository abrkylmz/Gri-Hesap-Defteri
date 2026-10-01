"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";
import { limitInput, type LimitInput } from "@/lib/validation";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
const MAX_LIMITS = 50;

async function mutate(run: (uid: string) => Promise<unknown[]>): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  try {
    if ((await run(user.userId)).length === 0) return NOT_FOUND;
  } catch (e) {
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/varliklar");
  return OK;
}

/** Kredi kartı / ek hesap limiti ekler ya da günceller (kişisel). */
export async function saveLimit(input: LimitInput): Promise<ActionResult> {
  const parsed = limitInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, bank, kind, name, limit, used } = parsed.data;
  const sql = db();
  return mutate((uid) =>
    id
      ? sql`update credit_limits set bank = ${bank}, kind = ${kind}, name = ${name}, limit_amount = ${limit},
                   used = ${used}, updated_at = now()
             where id = ${id} and user_id = ${uid} returning id`
      : sql`insert into credit_limits (user_id, bank, kind, name, limit_amount, used, sort)
            select ${uid}, ${bank}, ${kind}, ${name}, ${limit}, ${used}, coalesce(max(sort), 0) + 1
              from credit_limits where user_id = ${uid}
            having count(*) < ${MAX_LIMITS}
            returning id`,
    // Eklemede satır dönmemesi yalnızca sınıra ulaşıldığı anlamına gelir.
  ).then((r) => (!id && r === NOT_FOUND ? fail(`En fazla ${MAX_LIMITS} limit ekleyebilirsin.`) : r));
}

export async function deleteLimit(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from credit_limits where id = ${id} and user_id = ${uid} returning id`);
}
