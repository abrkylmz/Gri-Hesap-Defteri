import type { Metadata } from "next";
import { getHoldings } from "@/lib/data";
import { getRates } from "@/lib/fx";
import { AssetsView } from "./assets-view";

export const metadata: Metadata = { title: "Döviz & altın" };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ ekle }, rates, holdings] = await Promise.all([searchParams, getRates(), getHoldings()]);
  return <AssetsView rates={rates} holdings={holdings} openAdd={ekle === "1"} />;
}
