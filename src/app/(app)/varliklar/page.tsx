import type { Metadata } from "next";
import { getHoldings, getHomeCash, getLimits, getWallets } from "@/lib/data";
import { getRates } from "@/lib/fx";
import { AssetsView } from "./assets-view";

export const metadata: Metadata = { title: "Varlıklar" };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ ekle }, rates, holdings, wallets, homeCash, limits] = await Promise.all([
    searchParams,
    getRates().catch(() => []),
    getHoldings(),
    getWallets(),
    getHomeCash(),
    getLimits(),
  ]);
  return (
    <AssetsView
      rates={rates}
      holdings={holdings}
      openAdd={ekle === "1"}
      wallets={wallets}
      homeCash={homeCash}
      limits={limits}
    />
  );
}
