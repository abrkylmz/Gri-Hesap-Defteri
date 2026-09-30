import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { currentUser, requireUser, type SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Seçili defteri hatırlayan çerez. Yalnızca bir TERCİHTİR; yetki her istekte veritabanından doğrulanır. */
export const LEDGER_COOKIE = "gri_ledger";

export type Scope = {
  /** İşlemi yapan, oturumdaki kullanıcı */
  actor: SessionUser;
  /** Verisi okunup yazılan defterin sahibi (kendi defterinde actor ile aynı) */
  ownerId: string;
  ownerName: string;
  /** Başkasının defterinde mi? */
  shared: boolean;
};

async function resolve(actor: SessionUser): Promise<Scope> {
  const own: Scope = { actor, ownerId: actor.userId, ownerName: actor.username, shared: false };
  const wanted = (await cookies()).get(LEDGER_COOKIE)?.value;
  if (!wanted || wanted === actor.userId || !/^[0-9a-f-]{36}$/i.test(wanted)) return own;

  // Kabul edilmiş üyelik yoksa (davet geri çekildiyse, hesap silindiyse) sessizce kendi defterine düş.
  const [row] = (await db()`
    select u.username from ledger_members m join users u on u.id::text = m.owner_id
     where m.owner_id = ${wanted} and m.member_id = ${actor.userId} and m.status = 'accepted'
       and u.disabled_at is null`) as { username: string }[];
  return row ? { actor, ownerId: wanted, ownerName: row.username, shared: true } : own;
}

/** Sayfalar için: oturum yoksa girişe yönlendirir. İstek başına bir kez çalışır. */
export const getScope = cache(async (): Promise<Scope> => resolve(await requireUser()));

/** Sunucu aksiyonları için: oturum yoksa null döner (yönlendirme yerine hata mesajı gösterilir). */
export async function actionScope(): Promise<Scope | null> {
  const actor = await currentUser();
  return actor ? resolve(actor) : null;
}

export type LedgerAccess = { ownerId: string; name: string; own: boolean };
export type Invitation = { ownerId: string; ownerName: string; invitedMs: number };
export type Member = { memberId: string; username: string; status: "pending" | "accepted"; invitedMs: number };

/** Kullanıcının erişebildiği defterler (kendisi + kabul ettiği paylaşımlar) ve bekleyen davetleri. */
export const getSharing = cache(async () => {
  const { actor } = await getScope();
  const sql = db();
  const [access, invites, members] = await Promise.all([
    sql`select m.owner_id as "ownerId", u.username as name
          from ledger_members m join users u on u.id::text = m.owner_id
         where m.member_id = ${actor.userId} and m.status = 'accepted' and u.disabled_at is null
         order by u.username`,
    sql`select m.owner_id as "ownerId", u.username as "ownerName",
               (extract(epoch from m.invited_at) * 1000)::float8 as "invitedMs"
          from ledger_members m join users u on u.id::text = m.owner_id
         where m.member_id = ${actor.userId} and m.status = 'pending' and u.disabled_at is null
         order by m.invited_at desc`,
    sql`select m.member_id as "memberId", u.username, m.status,
               (extract(epoch from m.invited_at) * 1000)::float8 as "invitedMs"
          from ledger_members m join users u on u.id::text = m.member_id
         where m.owner_id = ${actor.userId}
         order by m.status, u.username`,
  ]);
  return {
    ledgers: [
      { ownerId: actor.userId, name: actor.username, own: true },
      ...(access as { ownerId: string; name: string }[]).map((l) => ({ ...l, own: false })),
    ] as LedgerAccess[],
    invitations: invites as Invitation[],
    members: members as Member[],
  };
});
