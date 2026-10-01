"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { MAX_MINOR } from "@/lib/money";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";
import { goalInput, type GoalInput } from "@/lib/validation";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
const MAX_GOALS = 30;

async function mutate(run: (uid: string) => Promise<unknown[]>): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  try {
    if ((await run(user.userId)).length === 0) return NOT_FOUND;
  } catch (e) {
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/", "layout");
  return OK;
}

/** Hedef ekler ya da günceller (kişisel). */
export async function saveGoal(input: GoalInput): Promise<ActionResult> {
  const parsed = goalInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, name, icon, target, saved, due } = parsed.data;
  const sql = db();
  return mutate((uid) =>
    id
      ? sql`update goals set name = ${name}, icon = ${icon}, target = ${target}, saved = ${saved}, due = ${due},
                   updated_at = now()
             where id = ${id} and user_id = ${uid} returning id`
      : sql`insert into goals (user_id, name, icon, target, saved, due, sort)
            select ${uid}, ${name}, ${icon}, ${target}, ${saved}, ${due}, coalesce(max(sort), 0) + 1
              from goals where user_id = ${uid}
            having count(*) < ${MAX_GOALS}
            returning id`,
    // Eklemede satır dönmemesi yalnızca sınıra ulaşıldığı anlamına gelir.
  ).then((r) => (!id && r === NOT_FOUND ? fail(`En fazla ${MAX_GOALS} hedef ekleyebilirsin.`) : r));
}

/** Hedefe para ekler (eksi tutar çeker); birikim 0'ın altına düşmez. */
export async function addToGoal(id: string, amount: number): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_MINOR) return fail("Geçerli bir tutar gir.");
  return mutate((uid) =>
    db()`update goals set saved = least(greatest(saved + ${amount}, 0), 99999999999), updated_at = now()
         where id = ${id} and user_id = ${uid} returning id`,
  );
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from goals where id = ${id} and user_id = ${uid} returning id`);
}
