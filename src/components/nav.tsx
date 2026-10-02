"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import { useApp } from "@/components/app-context";
import { useTxSheet } from "@/components/tx-sheet";
import { NAV_ICONS } from "@/components/nav-icons";
import { navTab, type NavTabKey } from "@/lib/nav-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";

// Masaüstü yan menü sırası (hepsi). Mobil alt çubukta kişinin seçtiği 2–5 sekme görünür.
const LINKS = (
  ["defter", "odemeler", "hedefler", "halka-arz", "kredi", "varliklar", "kategoriler", "duzenli", "ayarlar"] as NavTabKey[]
).map((key) => ({ ...navTab(key), icon: NAV_ICONS[key] }));

export function Nav({ tabs }: { tabs: NavTabKey[] }) {
  const pathname = usePathname();
  const { openNew } = useTxSheet();
  const { username, isAdmin } = useApp();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

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
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-5 py-8 lg:flex">
        <Link href="/" className="px-2">
          <BrandLogo height={38} />
        </Link>
        <button type="button" onClick={() => openNew()} className="btn btn-primary mt-10 w-full">
          <Plus size={18} strokeWidth={2.5} /> Yeni kayıt
          <kbd className="num ml-auto rounded bg-bg/15 px-1.5 text-[11px] opacity-70">N</kbd>
        </button>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Ana menü">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                isActive(href) ? "bg-surface-2 font-semibold text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              <Icon size={18} strokeWidth={isActive(href) ? 2.25 : 1.75} />
              {label}
            </Link>
          ))}
          {isAdmin && <hr className="my-3 border-line" />}
          {isAdmin && (
            <Link
              href="/yonetim"
              aria-current={isActive("/yonetim") ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                isActive("/yonetim") ? "bg-surface-2 font-semibold text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              <ShieldCheck size={18} strokeWidth={isActive("/yonetim") ? 2.25 : 1.75} />
              Yönetim
            </Link>
          )}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 pl-2">
          <p className="truncate text-xs text-ink-3" title={username}>
            {username}
          </p>
          <ThemeToggle />
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
            return <TabLink key={key} href={t.href} label={t.label} icon={NAV_ICONS[key]} active={isActive(t.href)} />;
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
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
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
      <Icon size={21} strokeWidth={active ? 2.25 : 1.6} />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
