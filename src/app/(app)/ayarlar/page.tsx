import type { Metadata } from "next";
import { getHomeLayout, getNavTabs, getSession } from "@/lib/data";
import { db } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";
import { getSharing } from "@/lib/scope";
import { DEFAULT_TZ } from "@/lib/dates";
import { Settings } from "./settings";
import type { SessionInfo } from "./account-settings";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/config";
import { hashToken } from "@/lib/password";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await getSession();
  // Para birimi ve saat dilimi kişiseldir: paylaşılan defterdeyken de KENDİ profilin gösterilir.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const mine = token ? hashToken(token) : "";
  const [profiles, sharing, publicKey, homeLayout, navTabs, account, sessions] = await Promise.all([
    db()`select currency, timezone from profiles where user_id = ${userId}`,
    getSharing(),
    vapidPublicKey(),
    getHomeLayout(),
    getNavTabs(),
    db()`select (extract(epoch from recovery_created_at) * 1000)::float8 as ms from users where id = ${userId}`,
    db()`select left(token_hash, 16) as id, user_agent as "userAgent",
                 (extract(epoch from created_at) * 1000)::float8 as "createdMs",
                 (extract(epoch from last_used_at) * 1000)::float8 as "lastUsedMs",
                 token_hash = ${mine} as current
            from sessions where user_id = ${userId} and expires_at > now()
           order by token_hash = ${mine} desc, coalesce(last_used_at, created_at) desc`,
  ]);
  const { kurtarildi } = await searchParams;
  const own = (profiles as { currency: string; timezone: string }[])[0];
  return (
    <Settings
      vapidPublicKey={publicKey}
      ownProfile={own ?? { currency: "TRY", timezone: DEFAULT_TZ }}
      sharing={sharing}
      homeLayout={homeLayout}
      navTabs={navTabs}
      recoveryMs={(account as { ms: number | null }[])[0]?.ms ?? null}
      sessions={sessions as SessionInfo[]}
      justRecovered={kurtarildi === "1"}
    />
  );
}
