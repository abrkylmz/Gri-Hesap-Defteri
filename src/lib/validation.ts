import { z } from "zod";
import { MAX_MINOR } from "@/lib/money";

z.config(z.locales.tr());

export const kindSchema = z.enum(["income", "expense"]);

const amount = z.number().int().positive().max(MAX_MINOR);
const note = z
  .string()
  .trim()
  .max(200, "Not en fazla 200 karakter olabilir")
  .transform((s) => s || null);

/** Vadeden kaç gün önce hatırlatılacağı; null = hatırlatma yok. */
export const remindDays = z.number().int().min(0).max(30).nullable();
export const REMIND_OPTIONS = [
  { days: null, label: "Kapalı" },
  { days: 0, label: "Aynı gün" },
  { days: 1, label: "1 gün önce" },
  { days: 3, label: "3 gün önce" },
  { days: 7, label: "1 hafta önce" },
] as const;
export const DEFAULT_REMIND_DAYS = 3;

export const transactionInput = z.object({
  id: z.uuid().optional(),
  kind: kindSchema,
  amount,
  categoryId: z.uuid().nullable(),
  note,
  occurredOn: z.iso.date(),
  remindDays: remindDays.default(null),
});
export type TransactionInput = z.input<typeof transactionInput>;

export const categoryInput = z.object({
  id: z.uuid().optional(),
  kind: kindSchema,
  name: z.string().trim().min(1, "İsim gerekli").max(40, "İsim en fazla 40 karakter olabilir"),
  emoji: z.string().trim().min(1).max(16),
  monthlyBudget: amount.nullable(),
});
export type CategoryInput = z.input<typeof categoryInput>;

export const recurringInput = z.object({
  id: z.uuid().optional(),
  kind: kindSchema,
  amount,
  categoryId: z.uuid().nullable(),
  note,
  dayOfMonth: z.number().int().min(1).max(31),
  startsOn: z.iso.date(),
  active: z.boolean(),
  remindDays: remindDays.default(null),
});
export type RecurringInput = z.input<typeof recurringInput>;

export const profileInput = z.object({
  currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
  timezone: z.string().min(1).max(64),
});
