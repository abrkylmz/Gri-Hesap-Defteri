import { AppProvider } from "@/components/app-context";
import { Nav } from "@/components/nav";
import { LedgerBanners } from "@/components/ledger-banners";
import { ToastProvider } from "@/components/toast";
import { TxSheetProvider } from "@/components/tx-sheet";
import { getCategories, getProfile, getSession } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { vapidPublicKey } from "@/lib/push";
import { getScope, getSharing } from "@/lib/scope";

// Oturum çerezine bağlı: statik ön-render denenmesin.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ username, role }, scope, profile, categories, sharing, publicKey] = await Promise.all([
    getSession(),
    getScope(),
    getProfile(),
    getCategories(),
    getSharing(),
    vapidPublicKey(),
  ]);

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
      }}
    >
      <ToastProvider>
        <TxSheetProvider>
          <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            <Nav />
            <main className="pt-safe min-w-0 pb-32 lg:pb-16">
              <LedgerBanners invitations={sharing.invitations} />
              {children}
            </main>
          </div>
        </TxSheetProvider>
      </ToastProvider>
    </AppProvider>
  );
}
