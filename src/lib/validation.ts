import { z } from "zod";
import { MAX_MINOR } from "@/lib/money";
import { WALLET_KIND_CODES } from "@/lib/wallets";
import { ASSET_CODES } from "@/lib/assets";
import { LIMIT_KIND_CODES } from "@/lib/limits";
export const LOAN_TYPE_CODES = ["ihtiyac", "tasit", "konut", "ticari"] as const;

z.config(z.locales.tr());

export const kindSchema = z.enum(["income", "expense"]);

export const amount = z.number().int().positive().max(MAX_MINOR);
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

export const FX_CODES = ["USD", "EUR", "GBP"] as const;
/** Yabancı parayla giriş: o paradaki tutar ve kur. TL tutarı sunucuda bunlardan hesaplanır. */
export const fxInput = z.object({
  code: z.enum(FX_CODES),
  amount: z.number().positive("Tutar sıfırdan büyük olmalı").max(1_000_000_000),
  rate: z.number().positive("Kur sıfırdan büyük olmalı").max(100_000),
});

export const transactionInput = z
  .object({
    id: z.uuid().optional(),
    /** Yeni kayıt için istemcide üretilen id: aynı kayıt (ör. çevrimdışı kuyruktan) iki kez gönderilse de bir kez eklenir. */
    newId: z.uuid().optional(),
    kind: kindSchema,
    // null yalnızca mevcut bir kaydı düzenlerken ("tutar bekleniyor" kaydı) kabul edilir.
    amount: amount.nullable(),
    categoryId: z.uuid().nullable(),
    note,
    occurredOn: z.iso.date(),
    remindDays: remindDays.default(null),
    fx: fxInput.nullable().default(null),
  })
  .refine((d) => d.amount !== null || d.id !== undefined, { message: "Önce bir tutar gir.", path: ["amount"] });
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

// ─── Şablonlar ──────────────────────────────────────────────────────────
export const templateInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Şablona bir ad ver").max(40, "Şablon adı en fazla 40 karakter olabilir"),
  items: z
    .array(
      z.object({
        kind: kindSchema,
        // Boş bırakılabilir: tutar şablon uygulanırken girilir.
        amount: amount.nullable(),
        categoryId: z.uuid().nullable(),
        note,
        dayOfMonth: z.number().int().min(1).max(31),
      }),
    )
    .min(1, "Şablonda en az bir satır olmalı")
    .max(100),
});
export type TemplateInput = z.input<typeof templateInput>;

export const applyTemplateInput = z.object({
  templateId: z.uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  // amount null: "tutar bekleniyor" olarak eklenir, sonra girilir.
  items: z.array(z.object({ itemId: z.uuid(), amount: amount.nullable() })).min(1, "Uygulanacak en az bir satır seç").max(100),
});
export type ApplyTemplateInput = z.input<typeof applyTemplateInput>;

// ─── Krediler ───────────────────────────────────────────────────────────
const pct = z.number().min(0).max(100);
export const loanInput = z
  .object({
    name: z.string().trim().min(1, "Krediye bir ad ver").max(60),
    principal: amount.nullable(),
    monthlyRate: pct.nullable(),
    kkdf: pct,
    bsmv: pct,
    termMonths: z.number().int().min(1, "Vade en az 1 ay").max(480, "Vade en fazla 480 ay"),
    firstDue: z.iso.date(),
    /** Taksit bankadan biliniyorsa; yoksa tutar + faizden hesaplanır */
    installment: amount.nullable(),
    categoryId: z.uuid().nullable(),
    remindDays: remindDays.default(3),
    /** Çekilen tutarı gelir olarak da ekle (bu tarihte) */
    incomeOn: z.iso.date().nullable(),
    /** Kredinin alındığı banka (isteğe bağlı) */
    bank: z.string().trim().max(40, "Banka adı en fazla 40 karakter olabilir").nullable().default(null)
      .transform((s) => s || null),
    loanType: z.enum(LOAN_TYPE_CODES).nullable().default(null),
  })
  .refine((d) => d.installment !== null || (d.principal !== null && d.monthlyRate !== null), {
    message: "Kredi tutarı ve faizi ya da taksit tutarını gir.",
  })
  .refine((d) => d.incomeOn === null || d.principal !== null, {
    message: "Gelir olarak eklemek için kredi tutarını gir.",
  });
export type LoanInput = z.input<typeof loanInput>;

/** Mevcut kredinin adı ve bankası (detay ekranından) */
export const loanInfoInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Krediye bir ad ver").max(60),
  bank: z.string().trim().max(40, "Banka adı en fazla 40 karakter olabilir").transform((s) => s || null),
});
export type LoanInfoInput = z.input<typeof loanInfoInput>;

// ─── Döviz ve altın ─────────────────────────────────────────────────────
export const holdingInput = z.object({
  id: z.uuid().optional(),
  asset: z.enum(ASSET_CODES),
  amount: z
    .number()
    .positive("Miktar sıfırdan büyük olmalı")
    .max(999_999_999)
    // En fazla 4 ondalık (veritabanı numeric(18,4))
    .refine((n) => Math.abs(n * 1e4 - Math.round(n * 1e4)) < 1e-6, { message: "En fazla 4 ondalık basamak" }),
  cost: amount.nullable(),
  note: z
    .string()
    .trim()
    .max(100)
    .transform((s) => s || null),
});
export type HoldingInput = z.input<typeof holdingInput>;

// ─── Halka arz ──────────────────────────────────────────────────────────
const lots = z.number().int().min(1, "Lot en az 1 olmalı").max(100_000_000);

export const ipoAccountInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Hesap adı gerekli").max(40, "Hesap adı en fazla 40 karakter olabilir"),
});

export const ipoInput = z.object({
  id: z.uuid().optional(),
  code: z.string().regex(/^[A-Z0-9]{2,10}$/, "Hisse kodu 2-10 harf/rakam olmalı (ör. ALTNY)"),
  name: z
    .string()
    .trim()
    .max(80)
    .transform((s) => s || null),
  offerPrice: amount,
  listedOn: z.iso.date().nullable(),
  allocations: z
    .array(z.object({ accountId: z.uuid(), lots: z.number().int().min(0).max(100_000_000) }))
    .max(50),
});
export type IpoInput = z.input<typeof ipoInput>;

export const ipoSaleInput = z.object({
  id: z.uuid().optional(),
  allocationId: z.uuid(),
  lots,
  price: amount,
  commission: z.number().int().min(0).max(MAX_MINOR),
  soldOn: z.iso.date(),
});
export type IpoSaleInput = z.input<typeof ipoSaleInput>;

export const profileInput = z.object({
  currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
  timezone: z.string().min(1).max(64),
});

// ─── Varlık yerleri (cüzdanlar) ─────────────────────────────────────────
export const walletInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Bir ad ver (ör. Garanti, Cüzdan)").max(40, "Ad en fazla 40 karakter olabilir"),
  kind: z.enum(WALLET_KIND_CODES),
  balance: z.number().int().min(0, "Bakiye eksi olamaz").max(MAX_MINOR),
});
export type WalletInput = z.input<typeof walletInput>;

// ─── Banka limitleri ────────────────────────────────────────────────────
export const limitInput = z.object({
  id: z.uuid().optional(),
  bank: z.string().trim().min(1, "Banka adını yaz").max(40, "Banka adı en fazla 40 karakter olabilir"),
  kind: z.enum(LIMIT_KIND_CODES),
  name: z
    .string()
    .trim()
    .max(40, "Ad en fazla 40 karakter olabilir")
    .transform((s) => s || null),
  limit: amount,
  used: z.number().int().min(0).max(MAX_MINOR).nullable(),
});
export type LimitInput = z.input<typeof limitInput>;

// ─── Kripto ─────────────────────────────────────────────────────────────
export const cryptoInput = z.object({
  id: z.uuid().optional(),
  symbol: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,12}$/, "Sembol 2-12 harf/rakam olmalı (ör. BTC)")),
  name: z
    .string()
    .trim()
    .max(40, "Ad en fazla 40 karakter olabilir")
    .transform((s) => s || null),
  amount: z.number().positive("Miktar sıfırdan büyük olmalı").lt(1e15),
  manualPrice: z.number().positive("Fiyat sıfırdan büyük olmalı").lt(1e12).nullable(),
  cost: amount.nullable(),
});
export type CryptoInput = z.input<typeof cryptoInput>;

// ─── Finansal hedefler ──────────────────────────────────────────────────
export const goalInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Hedefe bir ad ver (ör. Araba fonu)").max(40, "Ad en fazla 40 karakter olabilir"),
  icon: z.string().trim().min(1).max(16),
  target: amount,
  saved: z.number().int().min(0).max(MAX_MINOR),
  due: z.iso.date().nullable(),
});
export type GoalInput = z.input<typeof goalInput>;
