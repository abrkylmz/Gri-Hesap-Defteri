"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, OK, type ActionResult } from "@/lib/action-utils";
import { normalizeUsername } from "@/lib/password";
import { LEDGER_COOKIE } from "@/lib/scope";

const idSchema = z.uuid();
const MAX_MEMBERS = 10;
const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
const GENERIC = fail("Bir şeyler ters gitti. Lütfen tekrar dene.");

async function setLedgerCookie(ownerId: string | null) {
  const store = await cookies();
  if (!ownerId) {
    store.delete(LEDGER_COOKIE);
    return;
  }
  store.set(LEDGER_COOKIE, ownerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function done(): ActionResult {
  revalidatePath("/", "layout");
  return OK;
}

/** Kendi defterine bir kullanıcıyı davet eder (kullanıcı adıyla). Davetli kabul edince erişir. */
export async function inviteMember(rawUsername: string): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return SESSION_EXPIRED;
  const username = normalizeUsername(String(rawUsername ?? ""));
  if (!username) return fail("Davet edeceğin kişinin kullanıcı adını yaz.");
  if (username === me.username) return fail("Kendini davet edemezsin.");

  try {
    const sql = db();
    const [target] = (await sql`select id::text as id from users
      where username = ${username} and disabled_at is null`) as { id: string }[];
    if (!target) return fail(`"${username}" adında bir kullanıcı bulunamadı. Önce hesap açması gerekiyor.`);

    const [count] = (await sql`select count(*)::int as n from ledger_members where owner_id = ${me.userId}`) as {
      n: number;
    }[];
    if ((count?.n ?? 0) >= MAX_MEMBERS) return fail(`En fazla ${MAX_MEMBERS} kişiyle paylaşabilirsin.`);

    const rows = await sql`insert into ledger_members (owner_id, member_id)
      values (${me.userId}, ${target.id}) on conflict do nothing returning member_id`;
    if (rows.length === 0) return fail(`${username} zaten davet edilmiş.`);
  } catch (e) {
    console.error("[sharing] davet", e);
    return GENERIC;
  }
  return done();
}

/** Defter sahibi: bir üyenin erişimini ya da bekleyen davetini kaldırır. */
export async function removeMember(memberId: string): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return SESSION_EXPIRED;
  if (!idSchema.safeParse(memberId).success) return fail("Kullanıcı bulunamadı.");
  try {
    await db()`delete from ledger_members where owner_id = ${me.userId} and member_id = ${memberId}`;
  } catch (e) {
    console.error("[sharing] kaldır", e);
    return GENERIC;
  }
  return done();
}

/** Davetli: daveti kabul eder (ve o deftere geçer) ya da reddeder. */
export async function respondInvitation(ownerId: string, accept: boolean): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return SESSION_EXPIRED;
  if (!idSchema.safeParse(ownerId).success) return fail("Davet bulunamadı.");
  try {
    const sql = db();
    const rows = accept
      ? await sql`update ledger_members set status = 'accepted', accepted_at = now()
                  where owner_id = ${ownerId} and member_id = ${me.userId} and status = 'pending'
                  returning owner_id`
      : await sql`delete from ledger_members
                  where owner_id = ${ownerId} and member_id = ${me.userId} and status = 'pending'
                  returning owner_id`;
    if (rows.length === 0) return fail("Bu davet artık geçerli değil.");
    if (accept) await setLedgerCookie(ownerId);
  } catch (e) {
    console.error("[sharing] yanıt", e);
    return GENERIC;
  }
  return done();
}

/** Davetli: paylaşılan defterden ayrılır. */
export async function leaveLedger(ownerId: string): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return SESSION_EXPIRED;
  if (!idSchema.safeParse(ownerId).success) return fail("Defter bulunamadı.");
  try {
    await db()`delete from ledger_members where owner_id = ${ownerId} and member_id = ${me.userId}`;
    if ((await cookies()).get(LEDGER_COOKIE)?.value === ownerId) await setLedgerCookie(null);
  } catch (e) {
    console.error("[sharing] ayrıl", e);
    return GENERIC;
  }
  return done();
}

/** Görüntülenen defteri değiştirir. null ya da kendi id'si → kendi defteri. */
export async function switchLedger(ownerId: string | null): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return SESSION_EXPIRED;
  if (!ownerId || ownerId === me.userId) {
    await setLedgerCookie(null);
    return done();
  }
  if (!idSchema.safeParse(ownerId).success) return fail("Defter bulunamadı.");
  try {
    const rows = await db()`select 1 from ledger_members
      where owner_id = ${ownerId} and member_id = ${me.userId} and status = 'accepted'`;
    if (rows.length === 0) return fail("Bu deftere erişimin yok.");
    await setLedgerCookie(ownerId);
  } catch (e) {
    console.error("[sharing] geçiş", e);
    return GENERIC;
  }
  return done();
}
