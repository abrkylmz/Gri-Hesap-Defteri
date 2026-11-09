import type { Metadata } from "next";
import { after } from "next/server";
import {
  getAssetsOrder,
  getCryptoHoldings,
  getFunds,
  getHoldings,
  getHomeCash,
  getLimits,
  getProfile,
  getSession,
  getWallets,
} from "@/lib/data";
import { fundStats, fundTotals } from "@/lib/funds";
import type { FundsSummary } from "@/components/assets/funds-card";
import { getCryptoPrices } from "@/lib/crypto-prices";
import { todayIn } from "@/lib/dates";
import { getRates } from "@/lib/fx";
import { assetsTotal, debtsTotal } from "@/lib/net-worth";
import { getNetWorthHistory, ownLoansRemaining, recordNetWorth } from "@/lib/net-worth-store";
import { AssetsView } from "./assets-view";

export const metadata: Metadata = { title: "Varlıklar" };

export default async function AssetsPage() {
  const [{ userId, role }, profile, rates, holdings, wallets, homeCash, limits, crypto, loansLeft, history, order] =
    await Promise.all([
      getSession(),
      getProfile(),
      getRates().catch(() => []),
      getHoldings(),
      getWallets(),
      getHomeCash(),
      getLimits(),
      getCryptoHoldings(),
      getSession().then((s) => ownLoansRemaining(s.userId)),
      getSession().then((s) => getNetWorthHistory(s.userId)),
      getAssetsOrder(),
    ]);
  // Fonlar (yalnızca yönetici; Fon getirisi sayfasında elle girilen son değerler) toplam varlığa eklenir.
  let funds: FundsSummary | null = null;
  if (role === "admin") {
    const data = await getFunds(userId).catch(() => null);
    const stats = data ? fundStats(data.funds, data.values).filter((s) => s.value !== null) : [];
    if (stats.length) {
      const t = fundTotals(stats);
      funds = {
        value: t.value,
        daily: t.daily,
        dailyPct: t.dailyPct,
        lastDay: stats.reduce<string | null>((m, s) => (s.day && (!m || s.day > m) ? s.day : m), null),
        count: stats.length,
      };
    }
  }

  // Fiyat kaynağına ulaşılamasa da sayfa açılsın (elle girilen fiyatlar yine çalışır).
  const cryptoPrices = await getCryptoPrices(crypto.map((c) => c.symbol)).catch(() => ({}));

  // Net varlık: bugünün noktası yanıt gönderildikten sonra kaydedilir (günde bir satır).
  const debts = debtsTotal(limits, loansLeft);
  const assets = assetsTotal(wallets, holdings, rates, crypto, cryptoPrices) + (funds?.value ?? 0);
  if (assets > 0 || debts > 0) {
    const day = todayIn(profile.timezone);
    after(() => recordNetWorth(userId, day, assets, debts).catch((e) => console.error("[net] kayıt", e)));
  }

  return (
    <AssetsView
      rates={rates}
      holdings={holdings}
      wallets={wallets}
      homeCash={homeCash}
      limits={limits}
      crypto={crypto}
      cryptoPrices={cryptoPrices}
      netHistory={history}
      debts={debts}
      funds={funds}
      order={order}
    />
  );
}
