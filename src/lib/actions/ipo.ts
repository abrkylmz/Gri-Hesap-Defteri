"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import { amount } from "@/lib/validation";
import { dbError, fail, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import {
  ipoAccountInput,
  ipoInput,
  ipoSaleInput,
  type IpoInput,
  type IpoSaleInput,
} from "@/lib/validation";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";

const idSchema = z.uuid();
const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");

function mapError(e: unknown): ActionResult {
  if (isDbError(e)) {
    if (e.code === "23505") {
      return fail(e.constraint?.includes("code") ? "Bu kodla bir halka arz zaten var." : "Bu isimde bir hesap zaten var.");
    }
    if (e.code === "23514" && e.message.includes("aşamaz")) return fail("Satılan lot, gelen lotu aşamaz.");
    return dbError({ code: e.code, message: e.message });
  }
  return dbError({ message: String(e) });
}

/** Oturumu doğrula, işi çalıştır, hatayı Türkçe mesaja çevir, sayfayı tazele. */
async function mutate(work: (uid: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  try {
    const res = await work(user.userId);
    if (res && !res.ok) return res;
  } catch (e) {
    return mapError(e);
  }
  revalidatePath("/halka-arz");
  return OK;
}

// ─── Hesaplar ───────────────────────────────────────────────────────────

export async function saveIpoAccount(input: { id?: string; name: string }): Promise<ActionResult> {
  const parsed = ipoAccountInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, name } = parsed.data;
  return mutate(async (uid) => {
    const sql = db();
    const rows = id
      ? await sql`update ipo_accounts set name = ${name} where id = ${id} and user_id = ${uid} returning id`
      : await sql`insert into ipo_accounts (user_id, name, sort)
                  values (${uid}, ${name},
                          (select coalesce(max(sort), 0) + 1 from ipo_accounts where user_id = ${uid}))
                  returning id`;
    if (rows.length === 0) return NOT_FOUND;
  });
}

export async function deleteIpoAccount(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate(async (uid) => {
    const rows = await db()`delete from ipo_accounts where id = ${id} and user_id = ${uid} returning id`;
    if (rows.length === 0) return NOT_FOUND;
  });
}

// ─── Halka arzlar ───────────────────────────────────────────────────────

export async function saveIpo(input: IpoInput): Promise<ActionResult> {
  const parsed = ipoInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { code, name, offerPrice, listedOn, allocations } = parsed.data;

  return mutate(async (uid) => {
    const sql = db();
    const id = parsed.data.id ?? randomUUID();

    if (parsed.data.id) {
      const exists = await sql`select 1 from ipos where id = ${id} and user_id = ${uid}`;
      if (exists.length === 0) return NOT_FOUND;
      // Satış yapılmış bir hesabın lotu, satılan miktarın altına indirilemez.
      const sold = (await sql`
        select a.account_id::text as account_id, acc.name, coalesce(sum(s.lots), 0)::int as sold
          from ipo_allocations a
          join ipo_accounts acc on acc.id = a.account_id
          left join ipo_sales s on s.allocation_id = a.id
         where a.ipo_id = ${id} and a.user_id = ${uid}
         group by a.account_id, acc.name`) as { account_id: string; name: string; sold: number }[];
      for (const s of sold) {
        const next = allocations.find((a) => a.accountId === s.account_id)?.lots ?? 0;
        if (s.sold > 0 && next < s.sold) {
          return fail(`${s.name}: ${s.sold} lot satılmış; lot sayısı bundan az olamaz.`);
        }
      }
    }

    const queries = [
      parsed.data.id
        ? sql`update ipos set code = ${code}, name = ${name}, offer_price = ${offerPrice}, listed_on = ${listedOn}
              where id = ${id} and user_id = ${uid}`
        : sql`insert into ipos (id, user_id, code, name, offer_price, listed_on)
              values (${id}, ${uid}, ${code}, ${name}, ${offerPrice}, ${listedOn})`,
      ...allocations.map((a) =>
        a.lots > 0
          ? sql`insert into ipo_allocations (user_id, ipo_id, account_id, lots)
                values (${uid}, ${id}, ${a.accountId}, ${a.lots})
                on conflict (ipo_id, account_id) do update set lots = excluded.lots`
          : sql`delete from ipo_allocations
                where ipo_id = ${id} and account_id = ${a.accountId} and user_id = ${uid}`,
      ),
    ];
    await sql.transaction(queries);
  });
}

export async function deleteIpo(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate(async (uid) => {
    const rows = await db()`delete from ipos where id = ${id} and user_id = ${uid} returning id`;
    if (rows.length === 0) return NOT_FOUND;
  });
}

export async function setIpoPrice(id: string, price: number | null): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  if (price !== null && !amount.safeParse(price).success) return fail("Geçerli bir fiyat gir.");
  return mutate(async (uid) => {
    const rows = await db()`update ipos
      set current_price = ${price}, price_updated_at = ${price === null ? null : new Date().toISOString()}
      where id = ${id} and user_id = ${uid} returning id`;
    if (rows.length === 0) return NOT_FOUND;
  });
}

// ─── Satışlar ───────────────────────────────────────────────────────────

export async function saveIpoSale(input: IpoSaleInput): Promise<ActionResult> {
  const parsed = ipoSaleInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, allocationId, lots, price, commission, soldOn } = parsed.data;

  return mutate(async (uid) => {
    const sql = db();
    // Kalan lotu, düzenlenen satışın kendisini hariç tutarak hesapla (anlaşılır hata mesajı için;
    // asıl güvence veritabanı tetikleyicisinde).
    const [alloc] = (await sql`
      select a.lots,
             coalesce((select sum(s.lots) from ipo_sales s
                        where s.allocation_id = a.id and s.id is distinct from ${id ?? null}::uuid), 0)::int as sold
        from ipo_allocations a where a.id = ${allocationId} and a.user_id = ${uid}`) as { lots: number; sold: number }[];
    if (!alloc) return NOT_FOUND;
    const remaining = alloc.lots - alloc.sold;
    if (lots > remaining) return fail(`Bu hesapta en fazla ${remaining} lot satabilirsin.`);

    const rows = id
      ? await sql`update ipo_sales set lots = ${lots}, price = ${price}, commission = ${commission}, sold_on = ${soldOn}
                  where id = ${id} and user_id = ${uid} returning id`
      : await sql`insert into ipo_sales (user_id, allocation_id, lots, price, commission, sold_on)
                  values (${uid}, ${allocationId}, ${lots}, ${price}, ${commission}, ${soldOn}) returning id`;
    if (rows.length === 0) return NOT_FOUND;
  });
}

export async function deleteIpoSale(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  return mutate(async (uid) => {
    const rows = await db()`delete from ipo_sales where id = ${id} and user_id = ${uid} returning id`;
    if (rows.length === 0) return NOT_FOUND;
  });
}
