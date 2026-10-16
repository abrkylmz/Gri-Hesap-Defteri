import type { Metadata } from "next";
import { z } from "zod";
import { searchTransactions, type SearchFilters } from "@/lib/data";
import { toMinor } from "@/lib/money";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "Arama" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const date = (v: string) => (z.iso.date().safeParse(v).success ? v : null);

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const kind = one(p.tur);
  const filters: SearchFilters = {
    q: one(p.q).slice(0, 80),
    kind: kind === "income" || kind === "expense" ? kind : "all",
    categoryId: z.uuid().safeParse(one(p.kat)).success ? one(p.kat) : null,
    from: date(one(p.bas)),
    to: date(one(p.bit)),
    min: one(p.min) ? toMinor(one(p.min)) : null,
    max: one(p.max) ? toMinor(one(p.max)) : null,
  };
  const active =
    filters.q.trim() !== "" ||
    filters.kind !== "all" ||
    filters.categoryId !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.min !== null ||
    filters.max !== null;
  const results = active ? await searchTransactions(filters) : null;
  return (
    <SearchView
      initial={{
        q: filters.q,
        tur: filters.kind,
        kat: filters.categoryId ?? "",
        bas: filters.from ?? "",
        bit: filters.to ?? "",
        min: one(p.min),
        max: one(p.max),
      }}
      results={results}
    />
  );
}
