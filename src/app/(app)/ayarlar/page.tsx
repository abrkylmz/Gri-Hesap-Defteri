import type { Metadata } from "next";
import { getHomeLayout, getNavTabs, getSession } from "@/lib/data";
import { db } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";
import { getSharing } from "@/lib/scope";
import { DEFAULT_TZ } from "@/lib/dates";
import { Settings } from "./settings";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const { userId } = await getSession();
  // Para birimi ve saat dilimi kişiseldir: paylaşılan defterdeyken de KENDİ profilin gösterilir.
  const [profiles, sharing, publicKey, homeLayout, navTabs] = await Promise.all([
    db()`select currency, timezone from profiles where user_id = ${userId}`,
    getSharing(),
    vapidPublicKey(),
    getHomeLayout(),
    getNavTabs(),
  ]);
  const own = (profiles as { currency: string; timezone: string }[])[0];
  return (
    <Settings
      vapidPublicKey={publicKey}
      ownProfile={own ?? { currency: "TRY", timezone: DEFAULT_TZ }}
      sharing={sharing}
      homeLayout={homeLayout}
      navTabs={navTabs}
    />
  );
}
