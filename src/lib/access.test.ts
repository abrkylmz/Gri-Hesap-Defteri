import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

/*
 * Hesaplar arası erişim testi (gerçek şema, bellekte Postgres).
 *
 *   ayse  — verisi dolu hesap (ilk kullanıcı → yönetici)
 *   bora  — saldırgan: Ayşe'nin kimlikleriyle her işlemi dener, defter çerezini taklit eder
 *   cem   — Ayşe'nin defterine KABUL EDİLMİŞ üye (yalnızca ortak deftere erişir)
 *   deniz — daveti BEKLEYEN kullanıcı (henüz erişimi yok)
 *
 * Oturum, çerez ve başlıklar taklit edilir; sunucu eylemleri, veri fonksiyonları ve API uçları
 * gerçek kodlarıyla çalışır. Saldırıların ardından Ayşe'nin tüm satırları birebir karşılaştırılır.
 */

const pg = new PGlite();

vi.mock("@/lib/db", async (orig) => {
  const real = await orig<typeof import("@/lib/db")>();
  const run = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      let text = "";
      const params: unknown[] = [];
      strings.forEach((s, i) => {
        text += s;
        if (i < values.length) {
          const v = values[i] as { __unsafe?: string };
          if (v && typeof v === "object" && "__unsafe" in v) text += v.__unsafe;
          else {
            params.push(v);
            text += `$${params.length}`;
          }
        }
      });
      return run(text, params);
    },
    {
      unsafe: (s: string) => ({ __unsafe: s }),
      query: run,
      transaction: (items: Promise<unknown>[]) => Promise.all(items),
    },
  );
  return { ...real, db: () => sql };
});

// İstek bağlamı: çerezler ve başlıklar testten yönetilir.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    has: (n: string) => jar.has(n),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
  headers: async () => ({
    get: (n: string) => ({ "user-agent": "vitest", "x-real-ip": "10.0.0.1" })[n.toLowerCase()] ?? null,
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: () => {},
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { redirect: url });
  },
  notFound: () => {
    throw Object.assign(new Error("NOT_FOUND"), { notFound: true });
  },
}));
vi.mock("@/lib/push", () => ({ sendToUser: async () => 0 }));

const { hashToken } = await import("@/lib/password");
const { SESSION_COOKIE } = await import("@/lib/config");
const { LEDGER_COOKIE } = await import("@/lib/scope");
const entries = await import("@/lib/actions/entries");
const goals = await import("@/lib/actions/goals");
const wallets = await import("@/lib/actions/wallets");
const holdings = await import("@/lib/actions/holdings");
const crypto = await import("@/lib/actions/crypto");
const limits = await import("@/lib/actions/limits");
const ipo = await import("@/lib/actions/ipo");
const loans = await import("@/lib/actions/loans");
const funds = await import("@/lib/actions/funds");
const sharing = await import("@/lib/actions/sharing");
const account = await import("@/lib/actions/account");
const push = await import("@/lib/actions/push");
const support = await import("@/lib/actions/support");
const admin = await import("@/lib/actions/admin");
const home = await import("@/lib/actions/home");
const data = await import("@/lib/data");
const { currentUser } = await import("@/lib/auth");
const backupRoute = await import("@/app/api/yedek/route");
const exportRoute = await import("@/app/api/disa-aktar/route");
const supportRoute = await import("@/app/api/destek/route");
const widgetRoute = await import("@/app/api/widget/route");

const q = async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
  (await pg.query<T>(text, params)).rows;

const U: Record<"ayse" | "bora" | "cem" | "deniz", string> = {
  ayse: "",
  bora: "",
  cem: "",
  deniz: "",
};
const token = (name: keyof typeof U) => `tok-${name}-${"x".repeat(20)}`;

/** Bu kişi olarak istek at; `ledger` verilirse defter seçimi çerezi de gönderilir (taklit dahil). */
function as(name: keyof typeof U | null, ledger?: string) {
  jar.clear();
  if (name) jar.set(SESSION_COOKIE, token(name));
  if (ledger) jar.set(LEDGER_COOKIE, ledger);
}

/** Ayşe'ye ait her şey: user_id sütunu olan tüm tablolar + bağlı tablolar + kullanıcı satırı. */
async function snapshot(uid: string) {
  const tables = await q<{ t: string }>(
    `select distinct table_name as t from information_schema.columns
      where table_schema = 'public' and column_name = 'user_id' order by 1`,
  );
  const out: Record<string, unknown[]> = {};
  for (const { t } of tables) {
    out[t] = await q(`select to_jsonb(x) as r from ${t} x where user_id::text = $1 order by to_jsonb(x)::text`, [uid]);
  }
  out.users = await q(`select to_jsonb(u) - 'last_seen_at' as r from users u where id::text = $1`, [uid]);
  out.ledger_members = await q(
    `select to_jsonb(m) as r from ledger_members m where owner_id = $1 or member_id = $1 order by 1`,
    [uid],
  );
  out.fund_values = await q(
    `select to_jsonb(v) as r from fund_values v join funds f on f.id = v.fund_id where f.user_id::text = $1 order by 1`,
    [uid],
  );
  out.support_messages = await q(
    `select to_jsonb(m) as r from support_messages m join support_threads t on t.id = m.thread_id
      where t.user_id::text = $1 order by 1`,
    [uid],
  );
  return out;
}

type IdKey =
  | "category"
  | "recurring"
  | "tx"
  | "template"
  | "templateItem"
  | "goal"
  | "wallet"
  | "holding"
  | "crypto"
  | "limit"
  | "ipoAccount"
  | "ipo"
  | "allocation"
  | "sale"
  | "loan"
  | "fund"
  | "thread";
const ids = {} as Record<IdKey, string>;
const one = async (text: string, params: unknown[]) => String((await q<{ id: string }>(text, params))[0]!.id);
const SECRET = "AYSE-GIZLI";

beforeAll(async () => {
  await pg.exec(readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
  for (const name of Object.keys(U) as (keyof typeof U)[]) {
    U[name] = (await q<{ id: string }>(`select register_user($1, 'h')::text as id`, [name]))[0]!.id;
    await q("select ensure_user($1, 'Europe/Istanbul')", [U[name]]);
    await q("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [
      hashToken(token(name)),
      U[name],
    ]);
  }

  // Ayşe'nin verisi gerçek eylemlerle oluşturulur.
  as("ayse");
  const ok = (r: { ok: boolean; error?: string }) => expect(r, r.ok ? "" : r.error).toMatchObject({ ok: true });
  ok(
    await entries.saveCategory({
      kind: "expense",
      name: `${SECRET} kat`,
      emoji: "paw",
      monthlyBudget: 50000,
    }),
  );
  ids.category = await one("select id::text as id from categories where user_id = $1 and name like 'AYSE%'", [U.ayse]);
  ok(
    await entries.saveRecurring({
      kind: "expense",
      amount: 25000,
      categoryId: ids.category,
      note: `${SECRET} kira`,
      dayOfMonth: 5,
      startsOn: "2026-01-01",
      active: true,
    }),
  );
  ids.recurring = await one("select id::text as id from recurring where user_id = $1", [U.ayse]);
  ids.tx = "11111111-1111-4111-8111-111111111111";
  ok(
    await entries.saveTransaction({
      newId: ids.tx,
      kind: "expense",
      amount: 1200,
      categoryId: ids.category,
      note: `${SECRET} market`,
      occurredOn: "2026-10-06",
      remindDays: 3,
    }),
  );
  ok(
    await entries.saveTemplate({
      name: `${SECRET} şablon`,
      items: [
        {
          kind: "expense",
          amount: 5000,
          categoryId: ids.category,
          note: "Su",
          dayOfMonth: 10,
        },
      ],
    }),
  );
  ids.template = await one("select id::text as id from templates where user_id = $1", [U.ayse]);
  ids.templateItem = await one("select id::text as id from template_items where user_id = $1", [U.ayse]);
  ok(
    await goals.saveGoal({
      name: `${SECRET} hedef`,
      icon: "car",
      target: 100000,
      saved: 0,
      due: null,
    }),
  );
  ids.goal = await one("select id::text as id from goals where user_id = $1", [U.ayse]);
  ok(
    await wallets.saveWallet({
      name: `${SECRET} banka`,
      kind: "bank",
      balance: 500000,
    }),
  );
  ids.wallet = await one("select id::text as id from wallets where user_id = $1", [U.ayse]);
  ok(
    await holdings.saveHolding({
      asset: "USD",
      amount: 100,
      cost: null,
      note: SECRET,
    }),
  );
  ids.holding = await one("select id::text as id from holdings where user_id = $1", [U.ayse]);
  ok(
    await crypto.saveCrypto({
      symbol: "BTC",
      name: SECRET,
      amount: 0.5,
      manualPrice: null,
      cost: null,
    }),
  );
  ids.crypto = await one("select id::text as id from crypto_holdings where user_id = $1", [U.ayse]);
  ok(
    await limits.saveLimit({
      bank: SECRET,
      kind: "card",
      name: "",
      limit: 1000000,
      used: 0,
    }),
  );
  ids.limit = await one("select id::text as id from credit_limits where user_id = $1", [U.ayse]);
  ok(await ipo.saveIpoAccount({ name: SECRET }));
  ids.ipoAccount = await one("select id::text as id from ipo_accounts where user_id = $1", [U.ayse]);
  ok(
    await ipo.saveIpo({
      code: "GIZLI",
      name: SECRET,
      offerPrice: 2000,
      listedOn: null,
      allocations: [{ accountId: ids.ipoAccount, lots: 10 }],
    }),
  );
  ids.ipo = await one("select id::text as id from ipos where user_id = $1", [U.ayse]);
  ids.allocation = await one("select id::text as id from ipo_allocations where user_id = $1", [U.ayse]);
  ok(
    await ipo.saveIpoSale({
      allocationId: ids.allocation,
      lots: 2,
      price: 2500,
      commission: 0,
      soldOn: "2026-10-01",
    }),
  );
  ids.sale = await one("select id::text as id from ipo_sales where user_id = $1", [U.ayse]);
  ok(
    await loans.createLoan({
      name: `${SECRET} kredi`,
      principal: 1000000,
      monthlyRate: 3,
      kkdf: 15,
      bsmv: 15,
      termMonths: 3,
      firstDue: "2026-12-01",
      installment: null,
      categoryId: null,
      incomeOn: null,
    }),
  );
  ids.loan = await one("select id::text as id from loans where user_id = $1", [U.ayse]);
  ok(await funds.saveFund({ name: SECRET, code: "AFT", invested: 1000000 }));
  ids.fund = await one("select id::text as id from funds where user_id = $1", [U.ayse]);
  ok(
    await funds.saveFundValue({
      fundId: ids.fund,
      day: "2026-10-10",
      value: 1100000,
    }),
  );
  ok(
    await push.savePushSubscription({
      endpoint: "https://web.push.apple.com/ayse-cihaz",
      keys: { p256dh: "p", auth: "a" },
    }),
  );
  ok(await support.sendSupportMessage(`${SECRET} destek`));
  ids.thread = await one("select id::text as id from support_threads where user_id = $1", [U.ayse]);
  // Paylaşım: Cem kabul eder, Deniz bekler.
  ok(await sharing.inviteMember("cem"));
  ok(await sharing.inviteMember("deniz"));
  as("cem");
  ok(await sharing.respondInvitation(U.ayse, true));
  await q("update users set widget_token_hash = $1 where id = $2", [
    (await import("@/lib/widget")).hashWidgetToken("gw_" + "a".repeat(32)),
    U.ayse,
  ]);
}, 60_000);

/** Bora'nın erişebildiği herhangi bir çıktıda Ayşe'den iz var mı? */
function leaks(value: unknown) {
  const text = JSON.stringify(value);
  const found = [SECRET, ...Object.values(ids)].filter((s) => text.includes(s));
  return found;
}

describe("Başkasının kayıtları değiştirilemez / silinemez", () => {
  it("Bora, Ayşe'nin kimlikleriyle her eylemi dener; Ayşe'nin verisi birebir aynı kalır", async () => {
    const before = await snapshot(U.ayse);
    const attempts: [string, () => Promise<{ ok: boolean } | unknown>][] = [];
    const add = (name: string, fn: () => Promise<unknown>) => attempts.push([name, fn]);

    // Defter (işlemler, kategoriler, düzenli, şablon)
    add("saveTransaction(update)", () =>
      entries.saveTransaction({
        id: ids.tx,
        kind: "expense",
        amount: 1,
        categoryId: null,
        note: "x",
        occurredOn: "2026-10-06",
      }),
    );
    add("saveTransaction(newId çakışması)", () =>
      entries.saveTransaction({
        newId: ids.tx,
        kind: "expense",
        amount: 1,
        categoryId: null,
        note: "x",
        occurredOn: "2026-10-06",
      }),
    );
    add("saveTransaction(Ayşe'nin kategorisiyle)", () =>
      entries.saveTransaction({
        kind: "expense",
        amount: 1,
        categoryId: ids.category,
        note: "x",
        occurredOn: "2026-10-06",
      }),
    );
    add("deleteTransaction", () => entries.deleteTransaction(ids.tx));
    add("setTransactionPaid", () => entries.setTransactionPaid(ids.tx, true));
    add("restoreTransaction(aynı id)", () =>
      entries.restoreTransaction({
        id: ids.tx,
        kind: "expense",
        amount: 1,
        category_id: null,
        note: "x",
        occurred_on: "2026-10-06",
        recurring_id: null,
        remind_days: null,
        created_at: "2026-10-06 10:00:00+00",
      }),
    );
    add("payRecurringNow", () => entries.payRecurringNow(ids.recurring, "2026-11-05"));
    add("saveTemplate(update)", () =>
      entries.saveTemplate({
        id: ids.template,
        name: "x",
        items: [
          {
            kind: "expense",
            amount: 1,
            categoryId: null,
            note: "",
            dayOfMonth: 1,
          },
        ],
      }),
    );
    add("deleteTemplate", () => entries.deleteTemplate(ids.template));
    add("applyTemplate", () =>
      entries.applyTemplate({
        templateId: ids.template,
        month: "2026-11",
        items: [{ itemId: ids.templateItem, amount: 1 }],
      }),
    );
    add("saveCategory(update)", () =>
      entries.saveCategory({
        id: ids.category,
        kind: "expense",
        name: "x",
        emoji: "x",
        monthlyBudget: null,
      }),
    );
    add("deleteCategory", () => entries.deleteCategory(ids.category));
    add("saveRecurring(update)", () =>
      entries.saveRecurring({
        id: ids.recurring,
        kind: "expense",
        amount: 1,
        categoryId: null,
        note: "",
        dayOfMonth: 1,
        startsOn: "2026-01-01",
        active: false,
      }),
    );
    add("setRecurringActive", () => entries.setRecurringActive(ids.recurring, false));
    add("deleteRecurring", () => entries.deleteRecurring(ids.recurring));
    // Kişisel bölümler
    add("saveGoal(update)", () =>
      goals.saveGoal({
        id: ids.goal,
        name: "x",
        icon: "x",
        target: 1,
        saved: 0,
        due: null,
      }),
    );
    add("addToGoal", () => goals.addToGoal(ids.goal, 100));
    add("deleteGoal", () => goals.deleteGoal(ids.goal));
    add("saveWallet(update)", () =>
      wallets.saveWallet({
        id: ids.wallet,
        name: "x",
        kind: "bank",
        balance: 0,
      }),
    );
    add("deleteWallet", () => wallets.deleteWallet(ids.wallet));
    add("saveHolding(update)", () =>
      holdings.saveHolding({
        id: ids.holding,
        asset: "EUR",
        amount: 1,
        cost: null,
        note: "",
      }),
    );
    add("deleteHolding", () => holdings.deleteHolding(ids.holding));
    add("saveCrypto(update)", () =>
      crypto.saveCrypto({
        id: ids.crypto,
        symbol: "ETH",
        name: "",
        amount: 1,
        manualPrice: null,
        cost: null,
      }),
    );
    add("deleteCrypto", () => crypto.deleteCrypto(ids.crypto));
    add("saveLimit(update)", () =>
      limits.saveLimit({
        id: ids.limit,
        bank: "x",
        kind: "card",
        name: "",
        limit: 1,
        used: 0,
      }),
    );
    add("deleteLimit", () => limits.deleteLimit(ids.limit));
    // Halka arz
    add("saveIpoAccount(update)", () => ipo.saveIpoAccount({ id: ids.ipoAccount, name: "x" }));
    add("deleteIpoAccount", () => ipo.deleteIpoAccount(ids.ipoAccount));
    add("saveIpo(update)", () =>
      ipo.saveIpo({
        id: ids.ipo,
        code: "XX",
        name: "",
        offerPrice: 1,
        listedOn: null,
        allocations: [],
      }),
    );
    add("saveIpo(Ayşe'nin hesabına dağıtım)", () =>
      ipo.saveIpo({
        code: "YY",
        name: "",
        offerPrice: 1,
        listedOn: null,
        allocations: [{ accountId: ids.ipoAccount, lots: 5 }],
      }),
    );
    add("deleteIpo", () => ipo.deleteIpo(ids.ipo));
    add("setIpoPrice", () => ipo.setIpoPrice(ids.ipo, 1));
    add("saveIpoSale(update)", () =>
      ipo.saveIpoSale({
        id: ids.sale,
        allocationId: ids.allocation,
        lots: 1,
        price: 1,
        commission: 0,
        soldOn: "2026-10-01",
      }),
    );
    add("saveIpoSale(Ayşe'nin dağıtımına)", () =>
      ipo.saveIpoSale({
        allocationId: ids.allocation,
        lots: 1,
        price: 1,
        commission: 0,
        soldOn: "2026-10-01",
      }),
    );
    add("deleteIpoSale", () => ipo.deleteIpoSale(ids.sale));
    // Kredi
    add("deleteLoan", () => loans.deleteLoan(ids.loan));
    add("updateLoanInfo", () => loans.updateLoanInfo({ id: ids.loan, name: "x", bank: "" }));
    // Fonlar (yalnızca yönetici)
    add("saveFund(update)", () => funds.saveFund({ id: ids.fund, name: "x", code: "", invested: 1 }));
    add("deleteFund", () => funds.deleteFund(ids.fund));
    add("saveFundValue", () => funds.saveFundValue({ fundId: ids.fund, day: "2026-10-11", value: 1 }));
    add("deleteFundValue", () => funds.deleteFundValue(ids.fund, "2026-10-10"));
    // Paylaşım
    add("respondInvitation(davetsiz kabul)", () => sharing.respondInvitation(U.ayse, true));
    add("switchLedger(Ayşe)", () => sharing.switchLedger(U.ayse));
    add("removeMember(Cem)", () => sharing.removeMember(U.cem));
    // Hesap / cihaz / bildirim
    add("revokeSession(Ayşe)", async () => {
      const [s] = await q<{ id: string }>("select left(token_hash, 16) as id from sessions where user_id = $1", [
        U.ayse,
      ]);
      return account.revokeSession(s!.id);
    });
    add("deletePushSubscription(Ayşe)", async () => {
      await push.deletePushSubscription("https://web.push.apple.com/ayse-cihaz");
      return { ok: false };
    });
    // Destek ekibi işlemleri
    add("replySupport", () => support.replySupport(ids.thread, "x"));
    add("setSupportStatus", () => support.setSupportStatus(ids.thread, "closed"));
    add("deleteSnippet", () => support.deleteSnippet(ids.thread));
    // Yönetici işlemleri
    add("setUserDisabled(Ayşe)", () => admin.setUserDisabled(U.ayse, true));
    add("setUserRole(Ayşe→user)", () => admin.setUserRole(U.ayse, "user"));
    add("setUserRole(kendini admin)", () => admin.setUserRole(U.bora, "admin"));
    add("setSupportAgent(kendine)", () => admin.setSupportAgent(U.bora, true));
    add("resetUserPassword(Ayşe)", () => admin.resetUserPassword(U.ayse));
    add("deleteUser(Ayşe)", () => admin.deleteUser(U.ayse));
    add("setSignupOpen", () => admin.setSignupOpen(false));
    add("clearErrors", () => admin.clearErrors());

    const succeeded: string[] = [];
    for (const ledger of [undefined, U.ayse]) {
      // Hem kendi defterinden hem de Ayşe'nin defterini seçmiş gibi (taklit çerez) dener.
      for (const [name, fn] of attempts) {
        as("bora", ledger);
        const res = (await fn().catch((e: Error) => ({
          ok: false,
          threw: e.message,
        }))) as { ok?: boolean };
        if (res?.ok) succeeded.push(`${name}${ledger ? " [taklit defter]" : ""}`);
      }
    }

    // removeMember yalnızca kendi defterinin üyeliklerinde çalışır: Bora için etkisiz "tamam" (aşağıda veri karşılaştırması).
    expect(succeeded.filter((s) => !s.startsWith("removeMember"))).toEqual([]);
    expect(await snapshot(U.ayse)).toEqual(before);
    // Bora kendini yetkilendiremedi
    expect(
      (
        await q<{ role: string; support_agent: boolean }>("select role, support_agent from users where id = $1", [
          U.bora,
        ])
      )[0],
    ).toEqual({ role: "user", support_agent: false });
    expect(
      (await q<{ value: string }>("select value from app_settings where key = 'signup_open'"))[0]?.value ?? "true",
    ).toBe("true");
  });

  it("Bora'nın defterine Ayşe'nin kategorisi/hesabı bağlanamaz", async () => {
    const rows = await q("select 1 from transactions where user_id = $1 and category_id = $2", [U.bora, ids.category]);
    expect(rows).toEqual([]);
    expect(
      await q("select 1 from ipo_allocations where user_id = $1 and account_id = $2", [U.bora, ids.ipoAccount]),
    ).toEqual([]);
    expect(
      await q("select 1 from transactions where user_id = $1 and template_id = $2", [U.bora, ids.template]),
    ).toEqual([]);
  });
});

describe("Başkasının verisi okunamaz", () => {
  const reads = {
    getProfile: () => data.getProfile(),
    getCategories: () => data.getCategories(),
    getRecurring: () => data.getRecurring(),
    getTransactionsBetween: () => data.getTransactionsBetween("2000-01-01", "2100-01-01"),
    getIpoData: () => data.getIpoData(),
    getTemplates: () => data.getTemplates("2026-11"),
    getHoldings: () => data.getHoldings(),
    getLoans: () => data.getLoans(),
    getLoanInstallments: () => data.getLoanInstallments(),
    getPlannedExpenses: () => data.getPlannedExpenses("2026-11-16"),
    getTrend: () => data.getTrend("2026-11"),
    getWallets: () => data.getWallets(),
    getLimits: () => data.getLimits(),
    getCryptoHoldings: () => data.getCryptoHoldings(),
    getGoals: () => data.getGoals(),
    getUnpaidExpenses: () => data.getUnpaidExpenses("2000-01-01", "2100-01-01"),
    searchTransactions: () =>
      data.searchTransactions({
        q: "",
        kind: "all",
        categoryId: null,
        from: null,
        to: null,
        min: null,
        max: null,
      }),
    searchTransactionsByCategory: () =>
      data.searchTransactions({
        q: "",
        kind: "all",
        categoryId: ids.category,
        from: null,
        to: null,
        min: null,
        max: null,
      }),
    getYearSummary: () => data.getYearSummary(2026),
  };

  for (const ledger of [undefined, "ayse"] as const) {
    it(`Bora ${ledger ? "Ayşe'nin defter çerezini taklit ederek" : "kendi oturumuyla"} hiçbir sayfa verisinde Ayşe'yi görmez`, async () => {
      as("bora", ledger ? U.ayse : undefined);
      for (const [name, read] of Object.entries(reads)) {
        expect(leaks(await read()), name).toEqual([]);
      }
    });
  }

  it("bekleyen davetli (Deniz) Ayşe'nin defterini açamaz", async () => {
    as("deniz", U.ayse);
    expect(leaks(await data.getTransactionsBetween("2000-01-01", "2100-01-01"))).toEqual([]);
    expect(leaks(await data.getCategories())).toEqual([]);
    expect(await sharing.switchLedger(U.ayse)).toMatchObject({ ok: false });
  });

  it("API uçları: yedek, CSV, destek, widget", async () => {
    as("bora", U.ayse);
    const backup = await (await backupRoute.GET()).text();
    expect(leaks(backup)).toEqual([]);
    const csv = await (await exportRoute.GET()).text();
    expect(leaks(csv)).toEqual([]);
    const thread = await supportRoute.GET(new Request(`https://x.app/api/destek?thread=${ids.thread}`));
    expect(thread.status).toBe(404);
    const inbox = await supportRoute.GET(new Request("https://x.app/api/destek?inbox=1"));
    expect(inbox.status).toBe(404);
    const own = await (await supportRoute.GET(new Request("https://x.app/api/destek"))).text();
    expect(leaks(own)).toEqual([]);

    as(null);
    expect((await backupRoute.GET()).status).toBe(401);
    expect((await exportRoute.GET()).status).toBe(401);
    for (const auth of ["", "Bearer gw_" + "b".repeat(32), "Bearer " + token("ayse")]) {
      const res = await widgetRoute.GET(
        new Request("https://x.app/api/widget", {
          headers: { authorization: auth },
        }),
      );
      expect(res.status).toBe(401);
    }
  });

  it("Ayşe'nin yedeği Bora'ya yüklenirse Ayşe'nin satırları değişmez; Bora kopyaları yeni kimlikle alır", async () => {
    as("ayse");
    const backup = await (await backupRoute.GET()).text();
    const before = await snapshot(U.ayse);
    as("bora");
    const res = await backupRoute.POST(new Request("https://x.app/api/yedek", { method: "POST", body: backup }));
    expect(res.status).toBe(200);
    expect(await snapshot(U.ayse)).toEqual(before);
    // Bora'nın satırlarında Ayşe'nin kimlikleri kullanılmadı
    const boraIds = await q<{ id: string }>(
      "select id::text as id from transactions where user_id = $1 union all select id::text from goals where user_id = $1",
      [U.bora],
    );
    expect(boraIds.map((r) => r.id)).not.toContain(ids.tx);
    expect(boraIds.map((r) => r.id)).not.toContain(ids.goal);
    // Temizle (sonraki testler Bora'nın "temiz" olmasını bekler)
    await q("select delete_user($1::uuid)", [U.bora]);
    U.bora = (await q<{ id: string }>("select register_user('bora2', 'h')::text as id"))[0]!.id;
    await q("select ensure_user($1, 'Europe/Istanbul')", [U.bora]);
    await q("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [
      hashToken(token("bora")),
      U.bora,
    ]);
  });
});

describe("Erişim izni olan erişebilir; izin kalkınca erişim biter", () => {
  it("kabul edilmiş üye (Cem) ortak defteri görür ve yazar; Ayşe'nin kişisel bölümlerini görmez", async () => {
    as("cem", U.ayse);
    const txs = await data.getTransactionsBetween("2000-01-01", "2100-01-01");
    expect(JSON.stringify(txs)).toContain(ids.tx);
    // Kişisel bölümler (hesaplar, birikimler, kripto, limitler, hedefler, halka arz) defterle paylaşılmaz.
    for (const read of [
      data.getWallets,
      data.getHoldings,
      data.getCryptoHoldings,
      data.getLimits,
      data.getGoals,
      data.getIpoData,
    ]) {
      expect(leaks(await read())).toEqual([]);
    }
    expect(await funds.saveFund({ id: ids.fund, name: "x", code: "", invested: 1 })).toMatchObject({ ok: false });
    const newId = "22222222-2222-4222-8222-222222222222";
    expect(
      await entries.saveTransaction({
        newId,
        kind: "expense",
        amount: 300,
        categoryId: ids.category,
        note: "Cem",
        occurredOn: "2026-11-01",
      }),
    ).toEqual({ ok: true });
    const [row] = await q<{ user_id: string; created_by: string }>(
      "select user_id::text, created_by::text from transactions where id = $1",
      [newId],
    );
    expect(row).toEqual({ user_id: U.ayse, created_by: U.cem });
  });

  it("'Geri al' ile kayıt başka bir kullanıcının adına yazılamaz", async () => {
    as("bora");
    const id = "33333333-3333-4333-8333-333333333333";
    expect(
      await entries.restoreTransaction({
        id,
        kind: "expense",
        amount: 100,
        category_id: null,
        note: "sahte",
        occurred_on: "2026-11-01",
        recurring_id: null,
        remind_days: null,
        created_at: "2026-11-01 10:00:00+00",
        created_by: U.ayse,
      }),
    ).toEqual({ ok: true });
    const [row] = await q<{ user_id: string; created_by: string | null }>(
      "select user_id::text, created_by::text from transactions where id = $1",
      [id],
    );
    expect(row).toEqual({ user_id: U.bora, created_by: null });
  });

  it("Ayşe üyeliği kaldırınca Cem'in çerezi işe yaramaz", async () => {
    as("ayse");
    expect(await sharing.removeMember(U.cem)).toEqual({ ok: true });
    as("cem", U.ayse);
    expect(leaks(await data.getTransactionsBetween("2000-01-01", "2100-01-01"))).toEqual([]);
    expect(
      await entries.saveTransaction({
        kind: "expense",
        amount: 1,
        categoryId: null,
        note: "x",
        occurredOn: "2026-11-01",
      }),
    ).toEqual({ ok: true });
    // Yazılan kayıt Cem'in kendi defterine gider, Ayşe'ninkine değil.
    expect((await q("select 1 from transactions where user_id = $1 and note = 'x'", [U.cem])).length).toBe(1);
    expect((await q("select 1 from transactions where user_id = $1 and note = 'x'", [U.ayse])).length).toBe(0);
  });

  it("devre dışı bırakılan hesabın oturumu anında geçersiz; oturumsuz istek reddedilir", async () => {
    as("ayse");
    expect(await admin.setUserDisabled(U.deniz, true)).toEqual({ ok: true });
    as("deniz");
    expect(await currentUser()).toBeNull();
    expect(
      await entries.saveTransaction({
        kind: "expense",
        amount: 1,
        categoryId: null,
        note: "x",
        occurredOn: "2026-11-01",
      }),
    ).toMatchObject({ ok: false });
    as(null);
    expect(await currentUser()).toBeNull();
    await expect(data.getTransactionsBetween("2000-01-01", "2100-01-01")).rejects.toThrow(/REDIRECT \/giris/);
    expect(await home.saveAssetsOrder(["fx"])).toMatchObject({ ok: false });
    jar.set(SESSION_COOKIE, "uydurma-oturum");
    expect(await currentUser()).toBeNull();
  });
});
