import type { Metadata } from "next";
import { getProfile, getYearSummary } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { YearView } from "./year-view";

export const metadata: Metadata = { title: "Yıllık özet" };

export default async function YearPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { yil } = await searchParams;
  const profile = await getProfile();
  const thisYear = Number(todayIn(profile.timezone).slice(0, 4));
  const asked = Number(Array.isArray(yil) ? yil[0] : yil);
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= thisYear ? asked : thisYear;
  return <YearView summary={await getYearSummary(year)} thisYear={thisYear} />;
}
