"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addMonths, monthLabel, monthShort } from "@/lib/dates";
import { cn } from "@/components/ui";

export function MonthRail({
  month,
  current,
  onNavigate,
}: {
  month: string;
  current: string;
  onNavigate: (month: string) => void;
}) {
  const months = useMemo(() => {
    const start = [month, addMonths(current, -23)].sort()[0]!;
    const end = [month, addMonths(current, 1)].sort()[1]!;
    const list: string[] = [];
    for (let m = start; m <= end; m = addMonths(m, 1)) list.push(m);
    return list;
  }, [month, current]);

  const scroller = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const s = scroller.current;
    const a = active.current;
    if (!s || !a) return;
    s.scrollLeft = a.offsetLeft - s.clientWidth / 2 + a.clientWidth / 2;
  }, [month]);

  return (
    <>
      <DesktopMonthPicker month={month} current={current} onNavigate={onNavigate} />
      <div className="flex items-center gap-1 lg:hidden">
        <RailArrow label="Önceki ay" onClick={() => onNavigate(addMonths(month, -1))}>
          <ChevronLeft size={18} />
        </RailArrow>
        <div
          ref={scroller}
          className="no-scrollbar relative flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]"
        >
          {months.map((m) => {
            const selected = m === month;
            const showYear = m.endsWith("-01") || m === months[0];
            return (
              <button
                key={m}
                ref={selected ? active : undefined}
                type="button"
                onClick={() => onNavigate(m)}
                aria-current={selected ? "true" : undefined}
                aria-label={monthLabel(m)}
                className={cn(
                  "relative flex h-12 min-w-14 shrink-0 snap-center flex-col items-center justify-center rounded-2xl px-3 transition-colors",
                  selected ? "bg-ink text-bg" : "text-ink-3 hover:text-ink",
                )}
              >
                <span className={cn("num text-[9px] leading-none tracking-widest", !showYear && "opacity-0")}>
                  {m.slice(0, 4)}
                </span>
                <span className="mt-1 text-sm font-medium capitalize leading-none">{monthShort(m)}</span>
                {m === current && !selected && (
                  <span className="absolute bottom-1 size-1 rounded-full bg-income-fill" />
                )}
              </button>
            );
          })}
        </div>
        <RailArrow label="Sonraki ay" onClick={() => onNavigate(addMonths(month, 1))}>
          <ChevronRight size={18} />
        </RailArrow>
      </div>
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Masaüstü: uzun ay şeridi yerine kompakt kontrol — ‹ Ekim 2026 › ve tıklayınca açılan
 * yıl/ay seçici. Seçili ay bu ay değilse "Bu aya dön" kısayolu çıkar.
 */
function DesktopMonthPicker({
  month,
  current,
  onNavigate,
}: {
  month: string;
  current: string;
  onNavigate: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const root = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca ya da Esc ile kapanır.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (m: string) => {
    setOpen(false);
    if (m !== month) onNavigate(m);
  };
  const toggle = () => {
    setYear(Number(month.slice(0, 4)));
    setOpen((o) => !o);
  };

  return (
    <div ref={root} className="relative hidden items-center gap-3 lg:flex">
      <div className="flex items-center rounded-full border border-line bg-surface p-1 shadow-[0_8px_24px_-18px_rgb(0_0_0/0.4)]">
        <RailArrow label="Önceki ay" onClick={() => go(addMonths(month, -1))}>
          <ChevronLeft size={18} />
        </RailArrow>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="flex h-10 min-w-44 items-center justify-center gap-2 rounded-full px-4 transition-colors hover:bg-surface-2"
        >
          <CalendarDays size={16} className="text-ink-3" />
          <span className="font-serif text-xl capitalize tracking-tight">{monthLabel(month)}</span>
          <ChevronDown size={15} className={cn("text-ink-3 transition-transform", open && "rotate-180")} />
        </button>
        <RailArrow label="Sonraki ay" onClick={() => go(addMonths(month, 1))}>
          <ChevronRight size={18} />
        </RailArrow>
      </div>
      {month !== current && (
        <button type="button" onClick={() => go(current)} className="chip">
          <span className="size-1.5 rounded-full bg-income-fill" /> Bu aya dön
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Ay seç"
          className="rise absolute left-0 top-full z-40 mt-2 w-80 rounded-3xl border border-line bg-surface p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <RailArrow label="Önceki yıl" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft size={18} />
            </RailArrow>
            <span className="num text-lg font-semibold">{year}</span>
            <RailArrow label="Sonraki yıl" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight size={18} />
            </RailArrow>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => {
              const m = `${year}-${pad(i + 1)}`;
              const selected = m === month;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => go(m)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "relative h-11 rounded-2xl text-sm capitalize transition-colors",
                    selected ? "bg-ink font-semibold text-bg" : "bg-surface-2/60 hover:bg-surface-2",
                  )}
                >
                  {monthShort(m)}
                  {m === current && !selected && (
                    <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-income-fill" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RailArrow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}
