"use client";

import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { bankKey, filterBanks, TURKISH_BANKS } from "@/lib/limits";
import { cn } from "@/components/ui";

type Option = { kind: "custom" | "bank"; value: string; group?: "mine" | "all" };

/**
 * Banka seçici: alana dokununca açılan balonda kullanıcının bankaları ve Türkiye'deki tüm
 * bankalar; yazdıkça süzülür. Listede olmayan bir ad yazılırsa "… olarak ekle" ile kendi
 * bankasını ekleyebilir. Klavye: ↑/↓ gezinir, Enter seçer, Esc kapatır.
 */
export function BankPicker({
  value,
  onChange,
  mine,
  autoFocus,
}: {
  value: string;
  onChange: (bank: string) => void;
  /** Kullanıcının daha önce kullandığı bankalar (üstte gösterilir) */
  mine: string[];
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const options = useMemo<Option[]>(() => {
    const q = value.trim();
    const own = filterBanks(mine, q).map((b) => ({ kind: "bank" as const, value: b, group: "mine" as const }));
    const all = filterBanks(
      TURKISH_BANKS.filter((b) => !mine.some((m) => bankKey(m) === bankKey(b))),
      q,
    ).map((b) => ({ kind: "bank" as const, value: b, group: "all" as const }));
    const exact = [...own, ...all].some((o) => bankKey(o.value) === bankKey(q));
    return [...(q && !exact ? [{ kind: "custom" as const, value: q }] : []), ...own, ...all];
  }, [value, mine]);

  // Dışarı dokununca kapanır.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (bank: string) => {
    onChange(bank.trim());
    setOpen(false);
    input.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (options.length ? (i + delta + options.length) % options.length : 0));
    } else if (e.key === "Enter" && open && options[active]) {
      e.preventDefault();
      pick(options[active].value);
    } else if (e.key === "Escape" && open) {
      // Açık pencereyi (çekmeceyi) değil yalnızca balonu kapat.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  const optionId = (i: number) => `${listId}-o${i}`;
  let lastGroup: Option["group"] | undefined;

  return (
    <div ref={root} className="relative">
      <span className="relative block">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          ref={input}
          className="input pl-10 pr-11"
          placeholder="Banka ara ya da yaz"
          maxLength={40}
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? optionId(active) : undefined}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Banka listesini kapat" : "Banka listesini aç"}
          onClick={() => {
            setOpen((o) => !o);
            input.current?.focus();
          }}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-3"
        >
          <ChevronDown size={17} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </span>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 animate-[rise_160ms_var(--ease-out-soft)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_40px_-16px_rgb(0_0_0/0.45)]">
          <ul id={listId} role="listbox" aria-label="Bankalar" className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {options.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">Banka bulunamadı.</li>}
            {options.map((o, i) => {
              const header =
                o.kind === "bank" && o.group !== lastGroup
                  ? o.group === "mine"
                    ? "Senin bankaların"
                    : "Tüm bankalar"
                  : null;
              if (o.kind === "bank") lastGroup = o.group;
              const selected = o.kind === "bank" && bankKey(o.value) === bankKey(value);
              return (
                <li key={`${o.kind}-${o.value}`} role="presentation">
                  {header && (
                    <p className="eyebrow px-3 pb-1 pt-2" aria-hidden>
                      {header}
                    </p>
                  )}
                  <button
                    id={optionId(i)}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      i === active ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    {o.kind === "custom" ? (
                      <>
                        <span className="grid size-6 place-items-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
                          <Plus size={14} />
                        </span>
                        <span>
                          <strong>“{o.value}”</strong> olarak ekle
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-ink-2">
                          {o.value.charAt(0).toLocaleUpperCase("tr")}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{o.value}</span>
                        {selected && <Check size={15} className="shrink-0 text-income" />}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
