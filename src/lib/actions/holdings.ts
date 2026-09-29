"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { holdingInput, type HoldingInput } from "@/lib/validation";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");

async function mutate(run: (uid: string) => Promise<unknown[]>): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  try {
    if ((await run(user.userId)).length === 0) return NOT_FOUND;
  } catch (e) {
    return isDbError(e) ? dbError({ code: e.code, message: e.message }) : dbError({ message: String(e) });
  }
  revalidatePath("/", "layout");
  return OK;
}

/** Döviz/altın birikimi ekler ya da günceller (kişisel). */
export async function saveHolding(input: HoldingInput): Promise<ActionResult> {
  const parsed = holdingInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, asset, amount, cost, note } = parsed.data;
  return mutate((uid) =>
    id
      ? db()`update holdings set asset = ${asset}, amount = ${amount}, cost = ${cost}, note = ${note}
             where id = ${id} and user_id = ${uid} returning id`
      : db()`insert into holdings (user_id, asset, amount, cost, note)
             values (${uid}, ${asset}, ${amount}, ${cost}, ${note}) returning id`,
  );
}

export async function deleteHolding(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from holdings where id = ${id} and user_id = ${uid} returning id`);
}
