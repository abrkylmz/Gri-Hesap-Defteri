"use client";

import { ArrowDown, ArrowUp, ChartColumn, Eye, EyeOff, LayoutGrid, Rows3 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveHomeLayout } from "@/lib/actions/home";
import { haptic } from "@/lib/haptics";
import { DEFAULT_LAYOUT, HOME_VIEWS, HOME_WIDGETS, type HomeLayout, type WidgetKey } from "@/lib/home-layout";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

const info = (key: WidgetKey) => HOME_WIDGETS.find((w) => w.key === key)!;

function ViewIcon({ view }: { view: HomeLayout["view"] }) {
  const Icon = view === "analyst" ? ChartColumn : view === "compact" ? Rows3 : LayoutGrid;
  return <Icon size={20} strokeWidth={1.9} className="text-ink-2" />;
}

/**
 * Ana ekranı kişiselleştirme: bölümleri gizle/göster, ana sütundakileri yukarı/aşağı taşı.
 * Kişiseldir (tüm cihazlarda aynı). Kapanınca `onDone` çağrılır.
 */
export function HomeLayoutEditor({ initial, onDone }: { initial: HomeLayout; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [layout, setLayout] = useState<HomeLayout>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: WidgetKey) => {
    haptic("select");
    setLayout((l) => ({
      ...l,
      hidden: l.hidden.includes(key) ? l.hidden.filter((k) => k !== key) : [...l.hidden, key],
    }));
  };
  const move = (key: WidgetKey, delta: -1 | 1) => {
    haptic("tap");
    setLayout((l) => {
      const order = [...l.order];
      const i = order.indexOf(key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= order.length) return l;
      [order[i], order[j]] = [order[j]!, order[i]!];
      return { ...l, order };
    });
  };

  const save = (value: HomeLayout | null, msg: string) =>
    startTransition(async () => {
      const res = await saveHomeLayout(value).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) return setError(res.error);
      toast(msg);
      setOpen(false);
    });

  const top = HOME_WIDGETS.filter((w) => !w.movable).map((w) => w.key);

  const row = (key: WidgetKey, index?: number) => {
    const shown = !layout.hidden.includes(key);
    const w = info(key);
    return (
      <li
        key={key}
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-line p-2.5 transition-opacity",
          shown ? "bg-surface" : "bg-surface-2/40 opacity-60",
        )}
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          aria-pressed={shown}
          aria-label={shown ? `${w.label}: gizle` : `${w.label}: göster`}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl transition-colors",
            shown ? "bg-income-fill/20 text-income" : "bg-surface-2 text-ink-3",
          )}
        >
          {shown ? <Eye size={17} /> : <EyeOff size={17} />}
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{w.label}</span>
          <span className="block truncate text-[11px] text-ink-3">{w.desc}</span>
        </span>
        {index !== undefined && (
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => move(key, -1)}
              disabled={index === 0}
              aria-label={`${w.label}: yukarı taşı`}
              className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-25"
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => move(key, 1)}
              disabled={index === layout.order.length - 1}
              aria-label={`${w.label}: aşağı taşı`}
              className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-25"
            >
              <ArrowDown size={16} />
            </button>
          </span>
        )}
      </li>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onExited={onDone}
      title="Ana ekran düzeni"
      footer={
        <div className="flex gap-2 pb-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setLayout(DEFAULT_LAYOUT);
              save(null, "Varsayılan düzene dönüldü");
            }}
            className="btn btn-ghost px-4 text-sm"
          >
            Varsayılan
          </button>
          <button type="button" disabled={pending} onClick={() => save(layout, "Ana ekran güncellendi")} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-5">
        <p className="text-sm text-ink-2">
          Görmek istemediğin bölümleri <EyeOff size={13} className="inline align-[-2px]" /> ile gizle, ana bölümlerin
          sırasını oklarla değiştir. Defter listesi her zaman görünür.
        </p>
        <section>
          <p className="eyebrow mb-2">Görünüm</p>
          <div role="radiogroup" aria-label="Ana ekran görünümü" className="grid grid-cols-3 gap-2">
            {HOME_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                role="radio"
                aria-checked={layout.view === v.key}
                onClick={() => {
                  haptic("select");
                  setLayout((l) => ({ ...l, view: v.key }));
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-all",
                  layout.view === v.key ? "border-ink bg-surface-2" : "border-line hover:bg-surface-2",
                )}
              >
                <ViewIcon view={v.key} />
                <span className="text-sm font-semibold">{v.label}</span>
                <span className="text-[11px] leading-snug text-ink-3">{v.desc}</span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <p className="eyebrow mb-2">Üst kısım</p>
          <ul className="space-y-2">{top.map((k) => row(k))}</ul>
        </section>
        <section>
          <p className="eyebrow mb-2">Ana bölümler · sıralanabilir</p>
          <ul className="space-y-2">{layout.order.map((k, i) => row(k, i))}</ul>
        </section>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
