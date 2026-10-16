import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Gerçek şemayla, bellekte çalışan Postgres (PGlite) üzerinde yedek al / geri yükle.
const pg = new PGlite();
vi.mock("@/lib/db", () => ({
  db: () => ({ query: async (text: string, params?: unknown[]) => (await pg.query(text, params)).rows }),
}));
const { exportBackup, parseBackup, restoreBackup } = await import("./backup");

const q = async <T,>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows;
let a = "";
let b = "";

beforeAll(async () => {
  await pg.exec(readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
  a = (await q<{ id: string }>("select register_user('ayse','h')::text as id"))[0]!.id;
  b = (await q<{ id: string }>("select register_user('bora','h')::text as id"))[0]!.id;
  await q("select ensure_user($1, 'Europe/Istanbul')", [a]);
  await q("select ensure_user($1, 'Europe/Istanbul')", [b]);
  // A'nın verisi: özel kategori, düzenli kayıt, işlem, şablon + kalem, hesap, hedef, halka arz
  const [cat] = await q<{ id: string }>(
    "insert into categories (user_id, kind, name, emoji, monthly_budget) values ($1,'expense','Kedi maması','paw',50000) returning id",
    [a],
  );
  const [market] = await q<{ id: string }>("select id from categories where user_id=$1 and kind='expense' order by sort limit 1", [a]);
  const [rec] = await q<{ id: string }>(
    "insert into recurring (user_id, kind, amount, category_id, day_of_month, starts_on) values ($1,'expense',25000,$2,5,'2026-01-01') returning id",
    [a, cat!.id],
  );
  await q(
    "insert into transactions (user_id, kind, amount, category_id, occurred_on, recurring_id, note) values ($1,'expense',25000,$2,'2026-10-05',$3,'Mama'),($1,'expense',1200,$4,'2026-10-06',null,'Ekmek')",
    [a, cat!.id, rec!.id, market!.id],
  );
  const [tpl] = await q<{ id: string }>("insert into templates (user_id, name) values ($1,'Ev') returning id", [a]);
  await q(
    "insert into template_items (user_id, template_id, kind, amount, category_id, day_of_month) values ($1,$2,'expense',5000,$3,10)",
    [a, tpl!.id, cat!.id],
  );
  await q("insert into wallets (user_id, name, kind, balance) values ($1,'Ziraat','bank',1000000)", [a]);
  await q("insert into goals (user_id, name, icon, target, saved) values ($1,'Tatil','plane',2000000,100000)", [a]);
  const [acc] = await q<{ id: string }>("insert into ipo_accounts (user_id, name) values ($1,'Garanti') returning id", [a]);
  const [ipo] = await q<{ id: string }>("insert into ipos (user_id, code, offer_price) values ($1,'ABCDE',2500) returning id", [a]);
  const [al] = await q<{ id: string }>(
    "insert into ipo_allocations (user_id, ipo_id, account_id, lots) values ($1,$2,$3,10) returning id",
    [a, ipo!.id, acc!.id],
  );
  await q("insert into ipo_sales (user_id, allocation_id, lots, price, sold_on) values ($1,$2,5,3000,'2026-10-01')", [a, al!.id]);
});

describe("tam yedek", () => {
  it("dışa aktarılan dosya geçerli bir yedek", async () => {
    const backup = await exportBackup(a, "ayse");
    const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
    expect(typeof parsed).not.toBe("string");
    expect(backup.data.transactions).toHaveLength(2);
    expect(backup.data.ipo_sales).toHaveLength(1);
  });

  it("başka hesaba yüklenince her şey bağlantılarıyla gelir", async () => {
    const backup = JSON.parse(JSON.stringify(await exportBackup(a, "ayse")));
    const report = await restoreBackup(b, backup);
    expect(report.every((r) => !r.failed)).toBe(true);

    const tx = await q<{ note: string; cat: string; rec: string | null; by: string }>(
      `select t.note, c.name as cat, t.recurring_id::text as rec, t.created_by::text as by
         from transactions t left join categories c on c.id = t.category_id where t.user_id = $1 order by t.note`,
      [b],
    );
    expect(tx.map((t) => [t.note, t.cat])).toEqual([
      ["Ekmek", expect.any(String)],
      ["Mama", "Kedi maması"],
    ]);
    // Düzenli kayıt bağlantısı B'nin kendi düzenli kaydına çevrildi
    const [rec] = await q<{ id: string }>("select id::text from recurring where user_id = $1", [b]);
    expect(tx[1]!.rec).toBe(rec!.id);
    expect(tx[1]!.by).toBe(b);
    // Varsayılan kategoriler (aynı ad) çoğalmadı
    const dup = await q<{ n: number }>(
      "select count(*)::int as n from (select kind, name from categories where user_id=$1 group by 1,2 having count(*)>1) x",
      [b],
    );
    expect(dup[0]!.n).toBe(0);
    const [sale] = await q<{ n: number }>("select count(*)::int as n from ipo_sales where user_id = $1", [b]);
    expect(sale!.n).toBe(1);
    const [item] = await q<{ n: number }>(
      "select count(*)::int as n from template_items i join templates t on t.id = i.template_id and t.user_id = i.user_id where i.user_id = $1",
      [b],
    );
    expect(item!.n).toBe(1);
  });

  it("aynı yedeği ikinci kez yüklemek çoğaltmaz", async () => {
    const backup = JSON.parse(JSON.stringify(await exportBackup(a, "ayse")));
    const before = await q<{ n: number }>("select count(*)::int as n from transactions where user_id = $1", [b]);
    // B'nin kendi yedeğini B'ye yükle (kimlikler B'de var) → hiçbir şey eklenmez
    const own = JSON.parse(JSON.stringify(await exportBackup(b, "bora")));
    const report = await restoreBackup(b, own);
    expect(report.reduce((s, r) => s + r.added, 0)).toBe(0);
    const after = await q<{ n: number }>("select count(*)::int as n from transactions where user_id = $1", [b]);
    expect(after[0]!.n).toBe(before[0]!.n);
    // A'nın verisi değişmedi
    const [mine] = await q<{ n: number }>("select count(*)::int as n from transactions where user_id = $1", [a]);
    expect(mine!.n).toBe(2);
    void backup;
  });

  it("bozuk ya da yabancı dosya reddedilir", () => {
    expect(parseBackup({ foo: 1 })).toBe("Bu dosya bir Gri Hesap Defteri yedeği değil.");
    expect(parseBackup({ app: "gri-hesap-defteri", version: 1, data: { transactions: "x" } })).toMatch(/bozuk/);
  });
});
