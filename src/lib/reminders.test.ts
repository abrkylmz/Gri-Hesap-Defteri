import { describe, expect, it } from "vitest";
import type { RecurringRow, TransactionRow } from "@/lib/types";
import { daysBetween, dueReminders, nextRecurringDue, reminderNotification, runKey, whenLabel } from "@/lib/reminders";

const rec = (p: Partial<RecurringRow>): RecurringRow => ({
  id: "r-" + Math.random(),
  kind: "expense",
  amount: 1800000,
  category_id: "kira",
  note: null,
  day_of_month: 1,
  starts_on: "2026-01-01",
  active: true,
  remind_days: 3,
  ...p,
});

const tx = (p: Partial<TransactionRow>): TransactionRow => ({
  id: "t-" + Math.random(),
  kind: "expense",
  amount: 50000,
  category_id: null,
  note: "Vergi",
  occurred_on: "2026-10-01",
  recurring_id: null,
  remind_days: 3,
  paid: false,
  template_id: null,
  loan_id: null,
  fx_code: null,
  fx_amount: null,
  fx_rate: null,
  created_at: "",
  ...p,
});

describe("vade hesabı", () => {
  it("gün farkı ay/yıl sınırında doğru", () => {
    expect(daysBetween("2026-09-29", "2026-10-01")).toBe(2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-09-29", "2026-09-29")).toBe(0);
  });

  it("düzenli kaydın bir sonraki vadesi", () => {
    expect(nextRecurringDue({ day_of_month: 1, starts_on: "2026-01-01" }, "2026-09-29")).toBe("2026-10-01");
    expect(nextRecurringDue({ day_of_month: 29, starts_on: "2026-01-01" }, "2026-09-29")).toBe("2026-09-29");
    // Şubat'ta 31 → ayın son günü
    expect(nextRecurringDue({ day_of_month: 31, starts_on: "2026-01-01" }, "2026-02-10")).toBe("2026-02-28");
    // Henüz başlamamış kayıt başlangıçtan itibaren hesaplanır
    expect(nextRecurringDue({ day_of_month: 5, starts_on: "2026-12-10" }, "2026-09-29")).toBe("2027-01-05");
  });
});

describe("hatırlatma penceresi", () => {
  const today = "2026-09-29";

  it("penceredeki düzenli ve tek seferlik giderleri, vadeye göre sıralı döndürür", () => {
    const list = dueReminders(
      [
        rec({ id: "kira", day_of_month: 1, remind_days: 3 }), // 2 gün kaldı → dahil
        rec({ id: "uzak", day_of_month: 15, remind_days: 3 }), // 16 gün → hariç
        rec({ id: "kapali", day_of_month: 1, remind_days: null }), // hatırlatma kapalı
        rec({ id: "pasif", day_of_month: 1, active: false }), // duraklatılmış
        rec({ id: "maas", day_of_month: 1, kind: "income" }), // gelir → hariç
      ],
      [
        tx({ id: "vergi", occurred_on: "2026-09-30", remind_days: 1 }), // yarın → dahil
        tx({ id: "gecmis", occurred_on: "2026-09-28" }), // geçmiş → hariç
        tx({ id: "erken", occurred_on: "2026-10-10", remind_days: 3 }), // pencere dışı
        tx({ id: "uretilmis", occurred_on: "2026-09-30", recurring_id: "x" }), // düzenliden üretilmiş
        tx({ id: "bugun", occurred_on: "2026-09-29", remind_days: 0 }), // aynı gün → dahil
      ],
      today,
    );
    expect(list.map((r) => [r.sourceId, r.daysLeft])).toEqual([
      ["bugun", 0],
      ["vergi", 1],
      ["kira", 2],
    ]);
  });

  it("o dönemi erken ödenmiş (işlenmiş) düzenli kayıt hatırlatılmaz", () => {
    const kira = rec({ id: "kira", day_of_month: 1, remind_days: 3 });
    expect(dueReminders([kira], [], today)).toHaveLength(1);
    expect(dueReminders([kira], [], today, new Set([runKey("kira", "2026-10")]))).toHaveLength(0);
  });

  it("ödendi (✓) işaretli tek seferlik ödeme hatırlatılmaz", () => {
    expect(dueReminders([], [tx({ occurred_on: "2026-09-30", remind_days: 1, paid: true })], today)).toHaveLength(0);
  });

  it("zaman etiketi", () => {
    expect([0, 1, 3, 7].map(whenLabel)).toEqual(["bugün", "yarın", "3 gün sonra", "1 hafta sonra"]);
  });
});

describe("bildirim metni", () => {
  const names = (id: string) => ({ kira: "Kira" })[id];

  it("tek ödeme: başlıkta ne ve ne zaman", () => {
    const [r] = dueReminders([rec({ day_of_month: 1 })], [], "2026-09-30");
    const n = reminderNotification([r!], names, "TRY");
    expect(n.title).toBe("Kira yarın");
    expect(n.body).toMatch(/^₺18\.000,00 · 1 Eki/);
  });

  it("tutarı bekleyen ödeme: 'tutar belli değil' ve toplamda '+'", () => {
    const one = dueReminders([], [tx({ occurred_on: "2026-09-30", amount: null, note: "Elektrik" })], "2026-09-29");
    expect(reminderNotification(one, names, "TRY").body).toMatch(/^tutar belli değil · 30 Eyl/);
    const two = dueReminders([rec({ day_of_month: 1 })], [tx({ occurred_on: "2026-09-30", amount: null })], "2026-09-29");
    expect(reminderNotification(two, names, "TRY").title).toBe("2 ödeme yaklaşıyor · ₺18.000,00 +");
  });

  it("birden çok ödeme: toplam ve satırlar", () => {
    const list = dueReminders([rec({ day_of_month: 1 })], [tx({ occurred_on: "2026-09-30" })], "2026-09-29");
    const n = reminderNotification(list, names, "TRY");
    expect(n.title).toBe("2 ödeme yaklaşıyor · ₺18.500,00");
    expect(n.body.split("\n")).toEqual(["Vergi · yarın · ₺500,00", "Kira · 2 gün sonra · ₺18.000,00"]);
  });
});
