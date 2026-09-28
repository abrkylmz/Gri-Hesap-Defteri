import { cache } from "react";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, ProfileRow, RecurringRow, TransactionRow } from "@/lib/database.types";
import { addMonths, DEFAULT_TZ, monthStart } from "@/lib/dates";

export type Profile = Pick<ProfileRow, "currency" | "timezone">;
export type MonthTotal = { month: string; income: number; expense: number };

const PAGE = 1000; // Supabase varsayılan max-rows sınırı

function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(`Veri okunamadı: ${res.error.message}`);
  return res.data as T;
}

/** Oturum yoksa giriş sayfasına yönlendirir. İstek boyunca tek sefer çalışır. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/giris");
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
  };
});

export const getProfile = cache(async (): Promise<Profile> => {
  const { supabase } = await getSession();
  const data = unwrap(await supabase.from("profiles").select("currency, timezone").maybeSingle());
  return data ?? { currency: "TRY", timezone: DEFAULT_TZ };
});

export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  const { supabase } = await getSession();
  return unwrap(
    await supabase.from("categories").select("*").order("sort").order("name"),
  );
});

export const getRecurring = cache(async (): Promise<RecurringRow[]> => {
  const { supabase } = await getSession();
  return unwrap(
    await supabase.from("recurring").select("*").order("day_of_month").order("created_at"),
  );
});

/** Vadesi gelmiş düzenli kayıtları deftere işler (idempotent). */
export const materializeRecurring = cache(async () => {
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("materialize_recurring");
  if (error) console.error("materialize_recurring", error);
});

export async function getTransactionsBetween(from: string, toExclusive: string) {
  const { supabase } = await getSession();
  const rows: TransactionRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = unwrap(
      await supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", from)
        .lt("occurred_on", toExclusive)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1),
    );
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export const getMonthTransactions = (month: string) =>
  getTransactionsBetween(monthStart(month), monthStart(addMonths(month, 1)));

/** Seçili ay dahil son `span` ayın gelir/gider toplamları (eksik aylar sıfır). */
export async function getTrend(month: string, span = 6): Promise<MonthTotal[]> {
  const { supabase } = await getSession();
  const first = addMonths(month, -(span - 1));
  const rows = unwrap(
    await supabase.rpc("monthly_totals", {
      p_from: monthStart(first),
      p_to: monthStart(addMonths(month, 1)),
    }),
  );
  const byMonth = new Map(rows.map((r) => [r.month.slice(0, 7), r]));
  return Array.from({ length: span }, (_, i) => {
    const m = addMonths(first, i);
    const r = byMonth.get(m);
    return { month: m, income: Number(r?.income ?? 0), expense: Number(r?.expense ?? 0) };
  });
}
