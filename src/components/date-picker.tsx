"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { addMonths, dateInMonth, daysInMonth, monthLabel, monthOf, monthShort, weekdayName } from "@/lib/dates";
import { useApp } from "@/components/app-context";
import { cn } from "@/components/ui";

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const pad = (n: number) => String(n).padStart(2, "0");
const noop = () => () => {};

/** 1 = pazartesi … 7 = pazar olacak şekilde ayın ilk gününün sütun kayması (0-6). */
function firstColumn(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
}

const longDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${monthLabel(`${y}-${pad(m)}`).split(" ")[0]} ${y}`;
};

/**
 * Uygulamanın kendi takvimi: tarayıcı/işletim sistemi takvimi yerine, her platformda
 * aynı görünen ve temaya uyan bir seçici. Ortada açılan küçük bir pencere olarak çalışır;
 * açık bir çekmecenin (Sheet) üstünde de düzgün açılır.
 *
 * Pencere doğrudan <body> altına çizilir (portal): çekmecenin ve kaydırılabilir çip satırının
 * içinde iç içe kalırsa iOS Safari dokunuşları yanlış yere iletebiliyor, takvim dokunulamaz
 * hale geliyordu. En son açılan modal pencere olduğu için çekmece açıkken de etkileşimlidir.
 *
 * Kullanım: <DatePicker value onChange>{(open) => <button onClick={open}>…</button>}</DatePicker>
 */
export function DatePicker({
  value,
  onChange,
  min,
  children,
}: {
  value: string;
  onChange: (date: string) => void;
  /** Bu tarihten önceki günler seçilemez */
  min?: string;
  children: (open: () => void) => React.ReactNode;
}) {
  const { today } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"days" | "months">("days");
  const [month, setMonth] = useState(monthOf(value || today));
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  const open = () => {
    setMonth(monthOf(value || today));
    setView("days");
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  const pick = (date: string) => {
    onChange(date);
    close();
  };

  const year = Number(month.slice(0, 4));
  const disabled = (date: string) => Boolean(min && date < min);

  return (
    <>
      {children(open)}
      {mounted &&
        createPortal(
          <dialog
            ref={ref}
            data-calendar
            aria-label="Tarih seç"
            // React olayları portaldan da bileşen ağacında yukarı (açık çekmeceye) iletilir:
            // Esc ya da dokunuş yalnızca takvimi ilgilendirsin, alttaki kayıt ekranını kapatmasın.
            onCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              close();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === ref.current) close();
            }}
            className="m-auto w-[min(21rem,calc(100vw-2rem))] rounded-3xl border border-line bg-surface p-4 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[rise_220ms_var(--ease-out-soft)]"
          >
            {isOpen && (
              <div>
                {/* Başlık: ‹ Ekim 2026 › — başlığa dokununca ay/yıl görünümü */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    aria-label={view === "days" ? "Önceki ay" : "Önceki yıl"}
                    onClick={() => setMonth(addMonths(month, view === "days" ? -1 : -12))}
                    className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView(view === "days" ? "months" : "days")}
                    className="rounded-full px-3 py-1.5 font-serif text-xl capitalize tracking-tight hover:bg-surface-2"
                    aria-label="Ay ve yıl seç"
                  >
                    {view === "days" ? monthLabel(month) : year}
                  </button>
                  <button
                    type="button"
                    aria-label={view === "days" ? "Sonraki ay" : "Sonraki yıl"}
                    onClick={() => setMonth(addMonths(month, view === "days" ? 1 : 12))}
                    className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                {view === "days" ? (
                  <>
                    <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-ink-3">
                      {WEEKDAYS.map((w) => (
                        <span key={w} className="py-1">
                          {w}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1">
                      {Array.from({ length: firstColumn(month) }, (_, i) => (
                        <span key={`e${i}`} />
                      ))}
                      {Array.from({ length: daysInMonth(month) }, (_, i) => {
                        const date = dateInMonth(month, i + 1);
                        const selected = date === value;
                        const isToday = date === today;
                        return (
                          <button
                            key={date}
                            type="button"
                            disabled={disabled(date)}
                            onClick={() => pick(date)}
                            aria-pressed={selected}
                            aria-label={`${longDate(date)} ${weekdayName(date)}`}
                            className={cn(
                              "num mx-auto grid size-10 place-items-center rounded-full text-sm transition-colors",
                              selected
                                ? "bg-ink font-semibold text-bg"
                                : isToday
                                  ? "font-semibold text-ink ring-1 ring-inset ring-ink/40 hover:bg-surface-2"
                                  : "text-ink hover:bg-surface-2",
                              "disabled:pointer-events-none disabled:opacity-25",
                            )}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = `${year}-${pad(i + 1)}`;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setMonth(m);
                            setView("days");
                          }}
                          className={cn(
                            "h-12 rounded-2xl text-sm capitalize transition-colors",
                            m === month ? "bg-ink font-semibold text-bg" : "bg-surface-2/60 hover:bg-surface-2",
                          )}
                        >
                          {monthShort(m)}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <button
                    type="button"
                    disabled={disabled(today)}
                    onClick={() => pick(today)}
                    className="chip disabled:opacity-30"
                  >
                    Bugün
                  </button>
                  <button type="button" onClick={close} className="text-sm text-ink-2 hover:text-ink">
                    Kapat
                  </button>
                </div>
              </div>
            )}
          </dialog>,
          document.body,
        )}
    </>
  );
}

/** Form alanı görünümünde tarih seçici: "29 Eylül 2026 · Salı" + takvim simgesi. */
export function DateField({
  value,
  onChange,
  min,
  placeholder = "Tarih seç",
  className,
  ariaLabel = "Tarih",
}: {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <DatePicker value={value} onChange={onChange} min={min}>
      {(open) => (
        <button
          type="button"
          onClick={open}
          aria-label={value ? `${ariaLabel}: ${longDate(value)}` : ariaLabel}
          className={cn("input flex items-center gap-2 text-left", className)}
        >
          <Calendar size={16} className="shrink-0 text-ink-3" />
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-ink-3")}>
            {value ? (
              <>
                {longDate(value)} <span className="text-ink-3">· {weekdayName(value)}</span>
              </>
            ) : (
              placeholder
            )}
          </span>
        </button>
      )}
    </DatePicker>
  );
}
