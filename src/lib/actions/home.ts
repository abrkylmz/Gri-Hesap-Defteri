"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, invalid, OK, type ActionResult } from "@/lib/action-utils";
import { HOME_VIEW_KEYS, normalizeLayout, WIDGET_KEYS } from "@/lib/home-layout";
import { MAX_TABS, MIN_TABS, NAV_TAB_KEYS, normalizeTabs, REQUIRED_TAB } from "@/lib/nav-tabs";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";

const layoutInput = z.object({
  order: z.array(z.enum(WIDGET_KEYS)).max(20),
  hidden: z.array(z.enum(WIDGET_KEYS)).max(20),
  view: z.enum(HOME_VIEW_KEYS).default("standard"),
});

/** Ana ekran düzenini kaydeder (kişisel). null → varsayılana dön. */
export async function saveHomeLayout(input: unknown): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  let layout = null;
  if (input !== null) {
    const parsed = layoutInput.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    layout = normalizeLayout(parsed.data);
  }
  try {
    // Nakit kartı görünürlüğü eski home_cash sütunuyla da uyumlu tutulur.
    const homeCash = layout ? !layout.hidden.includes("cash") : false;
    await db()`insert into profiles (user_id, home_layout, home_cash)
               values (${user.userId}, ${layout ? JSON.stringify(layout) : null}::jsonb, ${homeCash})
               on conflict (user_id) do update
                 set home_layout = excluded.home_layout, home_cash = excluded.home_cash`;
  } catch (e) {
    console.error("[home] düzen", e);
    return fail("Düzen kaydedilemedi. Tekrar dene.");
  }
  revalidatePath("/", "layout");
  return OK;
}

const tabsInput = z
  .array(z.enum(NAV_TAB_KEYS))
  .min(MIN_TABS, "En az 2 sekme seç.")
  .max(MAX_TABS, "En fazla 5 sekme seçebilirsin.")
  .refine((t) => new Set(t).size === t.length, "Aynı sekme iki kez seçilemez.")
  .refine((t) => t.includes(REQUIRED_TAB), "Ayarlar sekmesi kaldırılamaz.");

/** Mobil alt çubuk sekmelerini kaydeder (kişisel). null → varsayılana dön. */
export async function saveNavTabs(input: unknown): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  let tabs: string[] | null = null;
  if (input !== null) {
    const parsed = tabsInput.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    tabs = normalizeTabs(parsed.data);
  }
  try {
    await db()`insert into profiles (user_id, nav_tabs) values (${user.userId}, ${tabs})
               on conflict (user_id) do update set nav_tabs = excluded.nav_tabs`;
  } catch (e) {
    console.error("[home] sekmeler", e);
    return fail("Sekmeler kaydedilemedi. Tekrar dene.");
  }
  revalidatePath("/", "layout");
  return OK;
}
