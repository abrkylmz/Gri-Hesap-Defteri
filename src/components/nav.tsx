"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Plus, Repeat, Settings2, Shapes, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/app-context";
import { useTxSheet } from "@/components/tx-sheet";
import { cn, Wordmark } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Defter", icon: BookOpen },
  { href: "/kategoriler", label: "Kategoriler", icon: Shapes },
  { href: "/duzenli", label: "Düzenli", icon: Repeat },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings2 },
] as const;

export function Nav() {
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
          <Wordmark className="text-xl" />
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
          {isAdmin && (
            <Link
              href="/yonetim"
              aria-current={isActive("/yonetim") ? "page" : undefined}
              className={cn(
                "mt-4 flex h-11 items-center gap-3 rounded-xl border-t border-line px-3 pt-px text-sm transition-colors",
                isActive("/yonetim") ? "bg-surface-2 font-semibold text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              <ShieldCheck size={18} strokeWidth={isActive("/yonetim") ? 2.25 : 1.75} />
              Yönetim
            </Link>
          )}
        </nav>
        <p className="mt-auto truncate px-2 text-xs text-ink-3" title={username}>
          {username}
        </p>
      </aside>

      {/* Mobil: alt çubuk */}
      <nav
        aria-label="Ana menü"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pt-1.5">
          {LINKS.slice(0, 2).map((l) => (
            <TabLink key={l.href} {...l} active={isActive(l.href)} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => openNew()}
              aria-label="Yeni kayıt"
              className="relative -mt-7 grid size-14 place-items-center rounded-full bg-ink text-bg shadow-[0_10px_30px_-10px_rgb(0_0_0/0.6)] transition-transform active:scale-90"
            >
              <Plus size={26} strokeWidth={2.5} />
              <span className="absolute right-1 top-1 size-2.5 rounded-full border-2 border-ink bg-income-fill" />
            </button>
          </div>
          {LINKS.slice(2).map((l) => (
            <TabLink key={l.href} {...l} active={isActive(l.href)} />
          ))}
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
}: (typeof LINKS)[number] & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 py-1.5 text-[10px] font-medium tracking-wide transition-colors",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <Icon size={21} strokeWidth={active ? 2.25 : 1.6} />
      {label}
    </Link>
  );
}
