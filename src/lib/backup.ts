import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

// Tam yedek: kişinin kendi defteri ve kişisel verileri (varlıklar, limitler, kripto, hedefler, halka arz,
// şablonlar, krediler…) tek bir JSON dosyasında. Geri yükleme mevcut verilere EKLER:
//   • Zaten bu hesapta olan satırlar (aynı kimlik) atlanır → aynı yedeği iki kez yüklemek çoğaltmaz.
//   • Doğal anahtarı aynı olan satır (ör. aynı adlı kategori/şablon) mevcut olanla eşleştirilir.
//   • Kimlik başka bir hesapta kullanılıyorsa yeni kimlik verilir (başka hesaba taşıma).
// Sahiplik, veritabanındaki bileşik yabancı anahtarlarla (id, user_id) ayrıca güvence altındadır.

export const BACKUP_APP = "gri-hesap-defteri";
export const BACKUP_VERSION = 1;
const MAX_ROWS = 100_000;

type TableSpec = {
  name: string;
  columns: string[];
  /** Aynı hesapta tekil olan alanlar: eşleşirse mevcut satır kullanılır */
  naturalKey?: string[];
  /** Başka tablolara bağlantılar: sütun → tablo. `required`: bağlantı çözülemezse satır atlanır */
  refs?: Record<string, { table: string; required?: boolean }>;
};

// Sıra önemli: önce bağlanılan tablolar.
export const BACKUP_TABLES: TableSpec[] = [
  {
    name: "categories",
    columns: ["id", "kind", "name", "emoji", "monthly_budget", "sort", "created_at"],
    naturalKey: ["kind", "name"],
  },
  {
    name: "recurring",
    columns: [
      "id",
      "kind",
      "amount",
      "category_id",
      "note",
      "day_of_month",
      "starts_on",
      "active",
      "created_at",
      "remind_days",
    ],
    refs: { category_id: { table: "categories" } },
  },
  { name: "templates", columns: ["id", "name", "created_at"], naturalKey: ["name"] },
  {
    name: "template_items",
    columns: ["id", "template_id", "kind", "amount", "category_id", "note", "day_of_month", "sort"],
    refs: { template_id: { table: "templates", required: true }, category_id: { table: "categories" } },
  },
  {
    name: "loans",
    columns: [
      "id",
      "name",
      "principal",
      "monthly_rate",
      "kkdf",
      "bsmv",
      "term_months",
      "first_due",
      "created_at",
      "bank",
      "loan_type",
    ],
  },
  {
    name: "transactions",
    columns: [
      "id",
      "kind",
      "amount",
      "category_id",
      "note",
      "occurred_on",
      "recurring_id",
      "created_at",
      "updated_at",
      "remind_days",
      "paid_at",
      "template_id",
      "loan_id",
      "installment_no",
      "fx_code",
      "fx_amount",
      "fx_rate",
    ],
    refs: {
      category_id: { table: "categories" },
      recurring_id: { table: "recurring" },
      template_id: { table: "templates" },
      loan_id: { table: "loans" },
    },
  },
  { name: "holdings", columns: ["id", "asset", "amount", "cost", "note", "created_at"] },
  { name: "wallets", columns: ["id", "name", "kind", "balance", "sort", "created_at", "updated_at"] },
  {
    name: "credit_limits",
    columns: [
      "id",
      "bank",
      "kind",
      "name",
      "limit_amount",
      "used",
      "sort",
      "created_at",
      "updated_at",
      "statement_day",
      "due_day",
    ],
  },
  {
    name: "crypto_holdings",
    columns: ["id", "symbol", "name", "amount", "manual_price", "cost", "created_at", "updated_at"],
  },
  { name: "goals", columns: ["id", "name", "icon", "target", "saved", "due", "sort", "created_at", "updated_at"] },
  { name: "ipo_accounts", columns: ["id", "name", "sort", "created_at"], naturalKey: ["name"] },
  {
    name: "ipos",
    columns: ["id", "code", "name", "offer_price", "listed_on", "current_price", "price_updated_at", "created_at"],
    naturalKey: ["code"],
  },
  {
    name: "ipo_allocations",
    columns: ["id", "ipo_id", "account_id", "lots", "created_at"],
    naturalKey: ["ipo_id", "account_id"],
    refs: { ipo_id: { table: "ipos", required: true }, account_id: { table: "ipo_accounts", required: true } },
  },
  {
    name: "ipo_sales",
    columns: ["id", "allocation_id", "lots", "price", "commission", "sold_on", "created_at"],
    refs: { allocation_id: { table: "ipo_allocations", required: true } },
  },
];

const PROFILE_COLUMNS = ["currency", "timezone", "watch_assets", "home_cash", "home_layout", "nav_tabs"] as const;

export type Backup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  username: string;
  profile: Record<string, unknown> | null;
  data: Record<string, Record<string, unknown>[]>;
};

/** Kişinin tüm verisi. Kimlikler korunur (geri yüklemede bağlantılar bunlarla kurulur). */
export async function exportBackup(userId: string, username: string): Promise<Backup> {
  const sql = db();
  const data: Backup["data"] = {};
  await Promise.all(
    BACKUP_TABLES.map(async (t) => {
      // Tablo/sütun adları sabit listeden gelir (kullanıcı girdisi değil).
      const cols = t.columns.map((c) => `"${c}"`).join(", ");
      data[t.name] = (await sql.query(`select ${cols} from ${t.name} where user_id = $1`, [userId])) as Record<
        string,
        unknown
      >[];
    }),
  );
  const [profile] = (await sql.query(`select ${PROFILE_COLUMNS.join(", ")} from profiles where user_id = $1`, [
    userId,
  ])) as Record<string, unknown>[];
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    username,
    profile: profile ?? null,
    data,
  };
}

export type RestoreReport = { table: string; added: number; skipped: number; failed?: string }[];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyOf = (row: Record<string, unknown>, cols: string[]) => cols.map((c) => String(row[c] ?? "")).join("\u0000");

/** Dosyanın yedek biçiminde olup olmadığını denetler. */
export function parseBackup(json: unknown): Backup | string {
  if (!json || typeof json !== "object") return "Dosya okunamadı.";
  const b = json as Partial<Backup>;
  if (b.app !== BACKUP_APP) return "Bu dosya bir Gri Hesap Defteri yedeği değil.";
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) return "Bu yedek daha yeni bir sürümle alınmış.";
  if (!b.data || typeof b.data !== "object") return "Yedekte veri yok.";
  let total = 0;
  for (const t of BACKUP_TABLES) {
    const rows = (b.data as Record<string, unknown>)[t.name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object")) return `Yedek bozuk (${t.name}).`;
    total += rows.length;
  }
  if (total > MAX_ROWS) return "Yedek çok büyük.";
  return b as Backup;
}

/** Yedeği kişinin hesabına ekler; tablo tablo kaç satır eklendiğini döndürür. */
export async function restoreBackup(userId: string, backup: Backup): Promise<RestoreReport> {
  const sql = db();
  const report: RestoreReport = [];
  // tablo → (yedekteki kimlik → bu hesaptaki kimlik)
  const maps = new Map<string, Map<string, string>>();

  for (const t of BACKUP_TABLES) {
    const map = new Map<string, string>();
    maps.set(t.name, map);
    const raw = (backup.data[t.name] ?? []).filter((r) => typeof r.id === "string" && UUID_RE.test(r.id as string));
    if (raw.length === 0) continue;
    try {
      // 1) Bağlantıları çevir; zorunlu bağlantısı çözülemeyen satırı at.
      const rows: Record<string, unknown>[] = [];
      for (const r of raw) {
        const row: Record<string, unknown> = {};
        for (const c of t.columns) row[c] = r[c] ?? null;
        let ok = true;
        for (const [col, ref] of Object.entries(t.refs ?? {})) {
          const v = row[col];
          if (v === null || v === undefined) {
            if (ref.required) ok = false;
            continue;
          }
          const mapped = maps.get(ref.table)?.get(String(v));
          if (mapped) row[col] = mapped;
          else if (ref.required) ok = false;
          else row[col] = null;
        }
        if (ok) rows.push(row);
      }

      // 2) Doğal anahtarı aynı mevcut satırlar (aynı adlı kategori vb.) eşleştirilir.
      let skipped = raw.length - rows.length;
      let fresh = rows;
      if (t.naturalKey) {
        const cols = t.naturalKey.map((c) => `"${c}"::text as "${c}"`).join(", ");
        const existing = (await sql.query(`select id::text as id, ${cols} from ${t.name} where user_id = $1`, [
          userId,
        ])) as Record<string, unknown>[];
        const byKey = new Map(existing.map((e) => [keyOf(e, t.naturalKey!), String(e.id)]));
        fresh = [];
        for (const row of rows) {
          const hit = byKey.get(keyOf(row, t.naturalKey));
          if (hit) {
            map.set(String(row.id), hit);
            skipped++;
          } else fresh.push(row);
        }
      }

      // 3) Kimlik çakışması: bu hesapta varsa atla, başka hesaptaysa yeni kimlik ver.
      const ids = fresh.map((r) => String(r.id));
      const taken = ids.length
        ? ((await sql.query(`select id::text as id, user_id::text as owner from ${t.name} where id = any($1::uuid[])`, [
            ids,
          ])) as { id: string; owner: string }[])
        : [];
      const owner = new Map(taken.map((x) => [x.id, x.owner]));
      const toInsert: Record<string, unknown>[] = [];
      for (const row of fresh) {
        const id = String(row.id);
        const o = owner.get(id);
        if (o === userId) {
          map.set(id, id);
          skipped++;
          continue;
        }
        const newId = o === undefined ? id : randomUUID();
        map.set(id, newId);
        toInsert.push({ ...row, id: newId, user_id: userId });
      }

      // 4) Ekle (tek sorgu; değerler veritabanı kurallarıyla denetlenir).
      let added = 0;
      if (toInsert.length) {
        const cols = ["user_id", ...t.columns];
        if (t.name === "transactions") cols.push("created_by");
        const payload = t.name === "transactions" ? toInsert.map((r) => ({ ...r, created_by: userId })) : toInsert;
        const list = cols.map((c) => `"${c}"`).join(", ");
        const res = (await sql.query(
          `insert into ${t.name} (${list})
           select ${list} from jsonb_populate_recordset(null::${t.name}, $1::jsonb)
           on conflict do nothing returning id`,
          [JSON.stringify(payload)],
        )) as unknown[];
        added = res.length;
        skipped += toInsert.length - added;
      }
      report.push({ table: t.name, added, skipped });
    } catch (e) {
      console.error("[backup] geri yükleme", t.name, e);
      report.push({ table: t.name, added: 0, skipped: raw.length, failed: "Bu bölüm yüklenemedi." });
    }
  }

  // Tercihler (para birimi, saat dilimi, ana ekran düzeni, alt menü…)
  const p = backup.profile;
  if (p && typeof p === "object") {
    try {
      await sql.query(
        `insert into profiles (user_id, currency, timezone, watch_assets, home_cash, home_layout, nav_tabs)
         select $1, coalesce(x.currency, 'TRY'), coalesce(x.timezone, 'Europe/Istanbul'), x.watch_assets,
                coalesce(x.home_cash, false), x.home_layout, x.nav_tabs
           from jsonb_populate_record(null::profiles, $2::jsonb) x
         on conflict (user_id) do update set currency = excluded.currency, timezone = excluded.timezone,
           watch_assets = excluded.watch_assets, home_cash = excluded.home_cash,
           home_layout = excluded.home_layout, nav_tabs = excluded.nav_tabs`,
        [userId, JSON.stringify(p)],
      );
    } catch (e) {
      console.error("[backup] profil", e);
    }
  }
  return report;
}
