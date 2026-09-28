import { AppProvider } from "@/components/app-context";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { TxSheetProvider } from "@/components/tx-sheet";
import { getCategories, getProfile, getSession } from "@/lib/data";
import { todayIn } from "@/lib/dates";

// Oturum çerezine bağlı: statik ön-render denenmesin (Neon Auth önerisi).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ email }, profile, categories] = await Promise.all([
    getSession(),
    getProfile(),
    getCategories(),
  ]);

  return (
    <AppProvider
      value={{
        currency: profile.currency,
        timezone: profile.timezone,
        today: todayIn(profile.timezone),
        email,
        categories,
      }}
    >
      <ToastProvider>
        <TxSheetProvider>
          <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            <Nav />
            <main className="pt-safe min-w-0 pb-32 lg:pb-16">{children}</main>
          </div>
        </TxSheetProvider>
      </ToastProvider>
    </AppProvider>
  );
}
