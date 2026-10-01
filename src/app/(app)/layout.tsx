import { AppProvider } from "@/components/app-context";
import { Nav } from "@/components/nav";
import { LedgerBanners } from "@/components/ledger-banners";
import { OfflineSync } from "@/components/offline-sync";
import { AddFab } from "@/components/add-fab";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ToastProvider } from "@/components/toast";
import { TxSheetProvider } from "@/components/tx-sheet";
import { getCategories, getNavTabs, getProfile, getSession } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { getRates } from "@/lib/fx";
import { vapidPublicKey } from "@/lib/push";
import { FX_CODES } from "@/lib/validation";
import { getScope, getSharing } from "@/lib/scope";

// Oturum çerezine bağlı: statik ön-render denenmesin.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ username, role }, scope, profile, categories, sharing, publicKey, rates, navTabs] = await Promise.all([
    getSession(),
    getScope(),
    getProfile(),
    getCategories(),
    getSharing(),
    vapidPublicKey(),
    // Kur kaynağına ulaşılamasa da uygulama açılsın; dövizle giriş o zaman elle kurla yapılır.
    getRates().catch(() => []),
    getNavTabs(),
  ]);
  const fxRates = Object.fromEntries(
    rates.filter((r) => (FX_CODES as readonly string[]).includes(r.code)).map((r) => [r.code, r.rate]),
  );

  return (
    <AppProvider
      value={{
        currency: profile.currency,
        timezone: profile.timezone,
        today: todayIn(profile.timezone),
        username,
        isAdmin: role === "admin",
        categories,
        ledger: { ownerId: scope.ownerId, ownerName: scope.ownerName, shared: scope.shared },
        ledgers: sharing.ledgers,
        vapidPublicKey: publicKey,
        fxRates,
      }}
    >
      <ToastProvider>
        <TxSheetProvider>
          <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            <Nav tabs={navTabs} />
            <main className="pt-safe min-w-0 pb-32 lg:pb-16">
              <MobileTopBar />
              <PullToRefresh>
                <OfflineSync />
                <LedgerBanners invitations={sharing.invitations} />
                {children}
              </PullToRefresh>
            </main>
          </div>
          {/* Tek "+" düğmesi: her sayfada sağ altta, tüm ekleme işlemleri */}
          <AddFab />
        </TxSheetProvider>
      </ToastProvider>
    </AppProvider>
  );
}
