"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutEffect, useMemo, useRef } from "react";
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
    <div className="flex items-center gap-1">
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
  );
}

function RailArrow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
