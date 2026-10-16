"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Headset, Inbox, Target } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";

const SHORTCUTS = [
  { href: "/odemeler", label: "Yaklaşan ödemeler", icon: CalendarClock },
  { href: "/hedefler", label: "Hedefler", icon: Target },
] as const;

/** Mobil üst çubuk: logo + yaklaşan ödemeler, hedefler ve açık/koyu geçişi (her sayfada). */
export function MobileTopBar() {
  const pathname = usePathname();
  const { support } = useApp();
  const alert =
    support.own > 0
      ? { href: "/destek", label: "Destek: yeni yanıt", icon: Headset }
      : support.staff && support.inbox > 0
        ? { href: "/destek/gelen", label: `Destek kutusu: ${support.inbox} sohbet bekliyor`, icon: Inbox }
        : null;
  return (
    <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-5 pt-2 lg:hidden">
      <Link href="/" aria-label="Ana sayfa" className="-ml-1 px-1">
        <BrandLogo height={34} />
      </Link>
      <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-sm">
        {SHORTCUTS.map(({ href, label, icon: Icon }) => {
          const on = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              aria-current={on ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-full transition-colors",
                on ? "bg-ink text-bg" : "text-ink hover:bg-surface-2",
              )}
            >
              <Icon size={19} strokeWidth={2} />
            </Link>
          );
        })}
        {alert && !pathname.startsWith(alert.href) && (
          <Link
            href={alert.href}
            aria-label={alert.label}
            title={alert.label}
            className="relative grid size-9 place-items-center rounded-full text-ink hover:bg-surface-2"
          >
            <alert.icon size={19} strokeWidth={2} />
            <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-expense ring-2 ring-surface" />
          </Link>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
