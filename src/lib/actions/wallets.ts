"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";
import { walletInput, type WalletInput } from "@/lib/validation";
import { normalizeLayout } from "@/lib/home-layout";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
const MAX_WALLETS = 50;

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

/** Varlık yeri ekler ya da günceller (kişisel). */
export async function saveWallet(input: WalletInput): Promise<ActionResult> {
  const parsed = walletInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, name, kind, balance } = parsed.data;
  const sql = db();
  return mutate((uid) =>
    id
      ? sql`update wallets set name = ${name}, kind = ${kind}, balance = ${balance}, updated_at = now()
             where id = ${id} and user_id = ${uid} returning id`
      : // Sınırsız satır eklenemesin; sıralama sona.
        sql`insert into wallets (user_id, name, kind, balance, sort)
            select ${uid}, ${name}, ${kind}, ${balance}, coalesce(max(sort), 0) + 1
              from wallets where user_id = ${uid}
            having count(*) < ${MAX_WALLETS}
            returning id`,
    // Eklemede satır dönmemesi yalnızca sınıra ulaşıldığı anlamına gelir.
  ).then((r) => (!id && r === NOT_FOUND ? fail(`En fazla ${MAX_WALLETS} yer ekleyebilirsin.`) : r));
}

export async function deleteWallet(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return mutate((uid) => db()`delete from wallets where id = ${id} and user_id = ${uid} returning id`);
}

/** Nakit varlıklar kartını ana ekranda göster / gizle (kişisel; ana ekran düzeninin parçası). */
export async function setHomeCash(on: boolean): Promise<ActionResult> {
  const value = on === true;
  return mutate(async (uid) => {
    const sql = db();
    const [row] = (await sql`select home_layout, home_cash from profiles where user_id = ${uid}`) as {
      home_layout: unknown;
      home_cash: boolean;
    }[];
    const layout = normalizeLayout(row?.home_layout ?? null, row?.home_cash ?? false);
    layout.hidden = value ? layout.hidden.filter((k) => k !== "cash") : [...new Set([...layout.hidden, "cash" as const])];
    return sql`insert into profiles (user_id, home_cash, home_layout)
                values (${uid}, ${value}, ${JSON.stringify(layout)}::jsonb)
                on conflict (user_id) do update set home_cash = excluded.home_cash, home_layout = excluded.home_layout
                returning user_id`;
  });
}
