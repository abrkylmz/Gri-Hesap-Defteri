"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  categoryInput,
  profileInput,
  recurringInput,
  transactionInput,
  type CategoryInput,
  type RecurringInput,
  type TransactionInput,
} from "@/lib/validation";
import { dbError, invalid, NOT_FOUND, OK, type ActionResult } from "@/lib/action-utils";
import { isValidTimeZone } from "@/lib/dates";

const idSchema = z.uuid();

function done(): ActionResult {
  revalidatePath("/", "layout");
  return OK;
}

// ─── İşlemler ───────────────────────────────────────────────────────────

export async function saveTransaction(input: TransactionInput): Promise<ActionResult> {
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, kind, amount, categoryId, note, occurredOn } = parsed.data;

  const supabase = await createClient();
  const row = { kind, amount, category_id: categoryId, note, occurred_on: occurredOn };
  const { data, error } = id
    ? await supabase.from("transactions").update(row).eq("id", id).select("id")
    : await supabase.from("transactions").insert(row).select("id");

  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}

// ─── Kategoriler ────────────────────────────────────────────────────────

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, kind, name, emoji, monthlyBudget } = parsed.data;

  const supabase = await createClient();
  // Tür (gelir/gider) sonradan değiştirilemez: bağlı işlemlerin tutarlılığı için.
  const { data, error } = id
    ? await supabase
        .from("categories")
        .update({ name, emoji, monthly_budget: kind === "expense" ? monthlyBudget : null })
        .eq("id", id)
        .select("id")
    : await supabase
        .from("categories")
        .insert({ kind, name, emoji, monthly_budget: kind === "expense" ? monthlyBudget : null, sort: 50 })
        .select("id");

  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}

// ─── Düzenli kayıtlar ───────────────────────────────────────────────────

export async function saveRecurring(input: RecurringInput): Promise<ActionResult> {
  const parsed = recurringInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, kind, amount, categoryId, note, dayOfMonth, startsOn, active } = parsed.data;

  const supabase = await createClient();
  const row = {
    kind,
    amount,
    category_id: categoryId,
    note,
    day_of_month: dayOfMonth,
    starts_on: startsOn,
    active,
  };
  const { data, error } = id
    ? await supabase.from("recurring").update(row).eq("id", id).select("id")
    : await supabase.from("recurring").insert(row).select("id");

  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}

export async function setRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring")
    .update({ active: Boolean(active) })
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}

// ─── Profil ─────────────────────────────────────────────────────────────

export async function updateProfile(input: {
  currency: string;
  timezone: string;
}): Promise<ActionResult> {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) {
    return { ok: false, error: "Geçersiz ayar." };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, error: "Oturumunun süresi dolmuş." };

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", userId)
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return NOT_FOUND;
  return done();
}
