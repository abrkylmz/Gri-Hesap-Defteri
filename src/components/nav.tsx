"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Inbox, Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import { useApp } from "@/components/app-context";
import { useTxSheet } from "@/components/tx-sheet";
import { NAV_ICONS } from "@/components/nav-icons";
import { navTab, type NavTabKey } from "@/lib/nav-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";

// Masaüstü yan menü: konuya göre gruplar. Mobil alt çubukta kişinin seçtiği 2–5 sekme görünür.
const link = (key: NavTabKey) => ({ ...navTab(key), icon: NAV_ICONS[key] });
const GROUPS: { title: string; links: ReturnType<typeof link>[] }[] = [
  { title: "Günlük", links: (["defter", "odemeler", "arama"] as NavTabKey[]).map(link) },
  { title: "Birikim", links: (["varliklar", "hedefler", "halka-arz", "kredi"] as NavTabKey[]).map(link) },
  { title: "Planlama", links: (["duzenli", "kategoriler", "yillik"] as NavTabKey[]).map(link) },
];

export function Nav({ tabs }: { tabs: NavTabKey[] }) {
  const pathname = usePathname();
  const { openNew } = useTxSheet();
  const { username, isAdmin, support } = useApp();
  // Destek sekmesindeki nokta: kullanıcıya gelen okunmamış yanıt.
  const dotFor = (href: string) => href === "/destek" && support.own > 0;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/destek" ? pathname === "/destek" : pathname.startsWith(href);

  // Masaüstü kısayolu: "N" yeni kayıt açar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select") || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      openNew();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNew]);

  return (
    <>
      {/* Masaüstü: sol ray */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 pb-4 pt-7 lg:flex">
        <Link href="/" className="px-2">
          <BrandLogo height={38} />
        </Link>
        <button type="button" onClick={() => openNew()} className="btn btn-primary mt-6 w-full">
          <Plus size={18} strokeWidth={2.5} /> Yeni kayıt
          <kbd className="num ml-auto rounded bg-bg/15 px-1.5 text-[11px] opacity-70">N</kbd>
        </button>
        <nav
          className="no-scrollbar -mx-2 mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]"
          aria-label="Ana menü"
        >
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-0.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                {g.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {g.links.map((l) => (
                  <SideLink key={l.href} href={l.href} label={l.label} icon={l.icon} active={isActive(l.href)} />
                ))}
              </div>
            </div>
          ))}
          {(support.staff || isAdmin) && (
            <div>
              <p className="mb-0.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Ekip</p>
              <div className="flex flex-col gap-0.5">
                {support.staff && (
                  <SideLink
                    href="/destek/gelen"
                    label="Destek kutusu"
                    icon={Inbox}
                    active={isActive("/destek/gelen")}
                    badge={support.inbox || undefined}
                  />
                )}
                {isAdmin && (
                  <SideLink href="/yonetim" label="Yönetim" icon={ShieldCheck} active={isActive("/yonetim")} />
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Alt: yardım, ayarlar ve hesap */}
        <div className="-mx-2 space-y-0.5 border-t border-line px-2 pt-3">
          <SideLink
            href="/destek"
            label="Destek"
            icon={NAV_ICONS.destek}
            active={isActive("/destek")}
            dot={dotFor("/destek")}
          />
          <SideLink href="/ayarlar" label="Ayarlar" icon={NAV_ICONS.ayarlar} active={isActive("/ayarlar")} />
          <div className="mt-2 flex items-center gap-2.5 rounded-2xl bg-surface-2/60 p-2">
            <span className="keep-serif grid size-8 shrink-0 place-items-center rounded-full bg-ink font-serif text-base text-bg">
              {username.slice(0, 1).toLocaleUpperCase("tr-TR")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium" title={username}>
                {username}
              </span>
              <span className="block text-[11px] text-ink-3">
                {isAdmin ? "Yönetici" : support.staff ? "Moderatör" : "Kişisel hesap"}
              </span>
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobil: alt çubuk */}
      <nav
        aria-label="Ana menü"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 transform-gpu border-t border-line bg-bg/85 backdrop-blur-xl [backface-visibility:hidden] lg:hidden"
      >
        <div
          className="mx-auto grid max-w-md items-center px-2 pt-1.5"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((key) => {
            const t = navTab(key);
            return (
              <TabLink
                key={key}
                href={t.href}
                label={t.label}
                icon={NAV_ICONS[key]}
                active={isActive(t.href)}
                dot={dotFor(t.href)}
              />
            );
          })}
        </div>
      </nav>
    </>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
  dot = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 py-1.5 text-[10px] font-medium tracking-wide transition-colors",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <span className="relative">
        <Icon size={21} strokeWidth={active ? 2.25 : 1.6} />
        {dot && <span className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-expense ring-2 ring-bg" />}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

/** Masaüstü yan menü satırı: etkin sayfada vurgulu; isteğe bağlı sayı rozeti ya da nokta. */
function SideLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  dot = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-[34px] items-center gap-3 rounded-xl px-3 text-sm transition-colors",
        active
          ? "bg-surface font-semibold text-ink shadow-sm ring-1 ring-line"
          : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
      )}
    >
      {active && <span aria-hidden className="absolute -left-2 top-2 bottom-2 w-1 rounded-full bg-income-fill" />}
      <Icon
        size={17}
        strokeWidth={active ? 2.25 : 1.75}
        className={active ? "text-ink" : "text-ink-3 group-hover:text-ink-2"}
      />
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="num ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-expense px-1.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      ) : dot ? (
        <span className="ml-auto size-2 rounded-full bg-expense" aria-label="yeni yanıt" />
      ) : null}
    </Link>
  );
}
