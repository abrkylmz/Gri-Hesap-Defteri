import type { Metadata } from "next";
import { vapidPublicKey } from "@/lib/push";
import { Settings } from "./settings";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  return <Settings vapidPublicKey={await vapidPublicKey()} />;
}
