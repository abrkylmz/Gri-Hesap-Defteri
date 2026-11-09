import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { widgetScript } from "./widget-script";

// Gerçek şemayla (PGlite) widget verisi; betik ise sahte Scriptable API'leriyle çalıştırılır.
const pg = new PGlite();
vi.mock("@/lib/db", async (orig) => {
  const real = await orig<typeof import("@/lib/db")>();
  const run = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;
  // Etiketli şablon (sql`...${x}...`) → $1, $2…; sql.unsafe(...) parçaları olduğu gibi eklenir.
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
    { unsafe: (s: string) => ({ __unsafe: s }), query: run },
  );
  return { ...real, db: () => sql };
});
const { hashWidgetToken, widgetData, widgetUser } = await import("./widget");

const q = async <T>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
let admin = "";
let user = "";

beforeAll(async () => {
  await pg.exec(readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
  admin = (await q<{ id: string }>("select register_user('yonetici','h')::text as id"))[0]!.id;
  user = (await q<{ id: string }>("select register_user('ali','h')::text as id"))[0]!.id;
  for (const id of [admin, user]) await q("select ensure_user($1, 'Europe/Istanbul')", [id]);
  await q("update users set widget_token_hash = $1 where id = $2", [hashWidgetToken("gw_" + "a".repeat(32)), admin]);
  await q(
    `insert into transactions (user_id, kind, amount, note, occurred_on, remind_days) values
     ($1,'expense',150000,'Kira',$2::date,3), ($1,'expense',4000,'Su',$3::date,3), ($1,'income',900000,'Maaş',$2::date,null)`,
    [admin, today, shift(today, -3)],
  );
  const [f] = await q<{ id: string }>(
    "insert into funds (user_id, name, invested) values ($1,'Teknoloji',1000000) returning id::text",
    [admin],
  );
  await q("insert into fund_values (fund_id, day, value) values ($1,$2::date,1100000),($1,$3::date,1122000)", [
    f!.id,
    shift(today, -1),
    today,
  ]);
  await q("insert into funds (user_id, name, invested) values ($1,'Gizli',1)", [user]);
});

describe("iPhone widget verisi", () => {
  it("anahtar sahibi bulunur; yanlış anahtar reddedilir", async () => {
    expect((await widgetUser("gw_" + "a".repeat(32)))?.id).toBe(admin);
    expect(await widgetUser("gw_" + "b".repeat(32))).toBeNull();
    expect(await widgetUser("çöp")).toBeNull();
  });

  it("bugünkü ödemeler, gecikmişler ve fon özeti (yönetici)", async () => {
    const d = await widgetData({ id: admin, role: "admin" });
    expect(d.date).toBe(today);
    expect(d.today.count).toBe(1);
    expect(d.today.items[0]!.name).toBe("Kira");
    expect(d.overdue.count).toBe(1);
    expect(d.funds?.daily).toMatch(/220/);
    expect(d.funds?.dailyUp).toBe(true);
    expect(d.funds?.totalPct).toMatch(/12,2/);
  });

  it("yönetici olmayana fon verisi gitmez", async () => {
    const d = await widgetData({ id: user, role: "user" });
    expect(d.funds).toBeNull();
    expect(d.today.count).toBe(0);
  });
});

describe("Scriptable betiği", () => {
  it("sahte Scriptable ortamında hatasız widget üretir", async () => {
    const data = await widgetData({ id: admin, role: "admin" });
    const texts: string[] = [];
    const node = (): Record<string, unknown> => ({
      addText: (t: string) => (texts.push(t), {}),
      addStack: () => node(),
      addSpacer: () => {},
      centerAlignContent: () => {},
      layoutVertically: () => {},
      setPadding: () => {},
    });
    let set: unknown = null;
    const env = {
      Color: Object.assign(function () {}, { dynamic: () => ({}) }),
      Font: { boldSystemFont: () => ({}), systemFont: () => ({}) },
      ListWidget: function () {
        return node();
      },
      Request: function () {
        return { headers: {}, loadJSON: async () => data, response: { statusCode: 200 } };
      },
      config: { runsInWidget: true, widgetFamily: "large" },
      Script: { setWidget: (w: unknown) => (set = w), complete: () => {} },
    };
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    const run = new AsyncFunction(...Object.keys(env), widgetScript("https://ornek.app", "gw_x"));
    await run(...Object.values(env));
    expect(set).not.toBeNull();
    expect(texts.join(" | ")).toMatch(/Bugün 1 ödeme/);
    expect(texts.join(" | ")).toMatch(/gecikmiş/);
  });
});
