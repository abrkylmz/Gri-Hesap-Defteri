"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";
import { cryptoInput, type CryptoInput } from "@/lib/validation";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
const MAX_CRYPTO = 100;

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

/** Kripto varlık ekler ya da günceller (kişisel). */
export async function saveCrypto(input: CryptoInput): Promise<ActionResult> {
  const parsed = cryptoInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, symbol, name, amount, manualPrice, cost } = parsed.data;
  const sql = db();
  return mutate((uid) =>
    id
      ? sql`update crypto_holdings set symbol = ${symbol}, name = ${name}, amount = ${amount},
                   manual_price = ${manualPrice}, cost = ${cost}, updated_at = now()
             where id = ${id} and user_id = ${uid} returning id`
      : sql`insert into crypto_holdings (user_id, symbol, name, amount, manual_price, cost)
            select ${uid}, ${symbol}, ${name}, ${amount}, ${manualPrice}, ${cost}
              from (select count(*) as n from crypto_holdings where user_id = ${uid}) c
             where c.n < ${MAX_CRYPTO}
            returning id`,
    // Eklemede satır dönmemesi yalnızca sınıra ulaşıldığı anlamına gelir.
  ).then((r) => (!id && r === NOT_FOUND ? fail(`En fazla ${MAX_CRYPTO} kripto ekleyebilirsin.`) : r));
}

export async function deleteCrypto(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from crypto_holdings where id = ${id} and user_id = ${uid} returning id`);
}
