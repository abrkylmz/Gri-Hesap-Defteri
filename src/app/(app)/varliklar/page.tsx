import type { Metadata } from "next";
import { getCryptoHoldings, getHoldings, getHomeCash, getLimits, getWallets } from "@/lib/data";
import { getCryptoPrices } from "@/lib/crypto-prices";
import { getRates } from "@/lib/fx";
import { AssetsView } from "./assets-view";

export const metadata: Metadata = { title: "Varlıklar" };

export default async function AssetsPage() {
  const [rates, holdings, wallets, homeCash, limits, crypto] = await Promise.all([
    getRates().catch(() => []),
    getHoldings(),
    getWallets(),
    getHomeCash(),
    getLimits(),
    getCryptoHoldings(),
  ]);
  // Fiyat kaynağına ulaşılamasa da sayfa açılsın (elle girilen fiyatlar yine çalışır).
  const cryptoPrices = await getCryptoPrices(crypto.map((c) => c.symbol)).catch(() => ({}));
  return (
    <AssetsView
      rates={rates}
      holdings={holdings}
      wallets={wallets}
      homeCash={homeCash}
      limits={limits}
      crypto={crypto}
      cryptoPrices={cryptoPrices}
    />
  );
}
