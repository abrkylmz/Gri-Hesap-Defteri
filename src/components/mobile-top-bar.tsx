"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Target } from "lucide-react";
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
        <ThemeToggle />
      </div>
    </div>
  );
}
