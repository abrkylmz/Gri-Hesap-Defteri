import { describe, expect, it } from "vitest";
import { groupPayments, upcomingPayments } from "@/lib/payments";
import type { RecurringRow, TransactionRow } from "@/lib/types";

const tx = (p: Partial<TransactionRow>): TransactionRow => ({
  id: Math.random().toString(36).slice(2),
  kind: "expense",
  amount: 10000,
  category_id: null,
  note: null,
  occurred_on: "2026-10-02",
  recurring_id: null,
  remind_days: null,
  paid: false,
  template_id: null,
  loan_id: null,
  fx_code: null,
  fx_amount: null,
  fx_rate: null,
  created_at: "",
  ...p,
});
const rec = (p: Partial<RecurringRow>): RecurringRow => ({
  id: "r1",
  kind: "expense",
  amount: 1800000,
  category_id: null,
  note: "Kira",
  day_of_month: 5,
  starts_on: "2026-01-01",
  active: true,
  remind_days: 3,
  ...p,
});

const today = "2026-10-02";

describe("yaklaşan ödemeler", () => {
  it("geçmiş tarihli sıradan harcama gecikmiş sayılmaz; kredi taksiti sayılır", () => {
    const r = upcomingPayments(
      [tx({ occurred_on: "2026-09-28", note: "Market" }), tx({ occurred_on: "2026-09-28", loan_id: "L", note: "Taksit" })],
      [],
      today,
    );
    expect(r.map((p) => [p.note, p.overdue])).toEqual([["Taksit", true]]);
  });
  it("bugün girilen sıradan harcama ödeme sayılmaz; bugünkü düzenli ödeme sayılır", () => {
    const r = upcomingPayments([tx({ note: "Kahve" }), tx({ note: "Kira", recurring_id: "r1" })], [], today);
    expect(r.map((p) => p.note)).toEqual(["Kira"]);
  });
  it("ödenmiş ve gelir kayıtları atlanır; ileri tarihli gider girer", () => {
    const r = upcomingPayments(
      [tx({ occurred_on: "2026-10-10", paid: true }), tx({ kind: "income", occurred_on: "2026-10-10" }), tx({ occurred_on: "2026-10-10", note: "Sigorta" })],
      [],
      today,
    );
    expect(r.map((p) => p.note)).toEqual(["Sigorta"]);
  });
  it("düzenli ödeme: bugünden sonraki tarihler (60 gün), erken ödenen dönem ve başlangıç öncesi hariç", () => {
    const r = upcomingPayments([], [rec({}), rec({ id: "r2", note: "Netflix", day_of_month: 1, starts_on: "2026-11-15" })], today, new Set(["r1|2026-11"]));
    expect(r.map((p) => [p.note, p.date])).toEqual([
      ["Kira", "2026-10-05"],
      ["Netflix", "2026-12-01"],
    ]);
  });
  it("gruplar: gecikmiş, bugün, bu hafta, bu ay, sonra", () => {
    const items = upcomingPayments(
      [
        tx({ occurred_on: "2026-09-30", remind_days: 3 }),
        tx({ occurred_on: "2026-10-02", remind_days: 0 }),
        tx({ occurred_on: "2026-10-06" }),
        tx({ occurred_on: "2026-10-25" }),
        tx({ occurred_on: "2026-11-20" }),
      ],
      [],
      today,
    );
    expect(groupPayments(items, today).map((g) => [g.key, g.items.length])).toEqual([
      ["overdue", 1],
      ["today", 1],
      ["week", 1],
      ["month", 1],
      ["later", 1],
    ]);
  });
});
