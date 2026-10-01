"use client";

import { ArrowLeft, ArrowRight, Lock, Minus, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { saveNavTabs } from "@/lib/actions/home";
import { haptic } from "@/lib/haptics";
import { DEFAULT_TABS, MAX_TABS, MIN_TABS, NAV_TABS, navTab, REQUIRED_TAB, type NavTabKey } from "@/lib/nav-tabs";
import { NAV_ICONS } from "@/components/nav-icons";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

/**
 * Mobil alt çubuğu kişiselleştirme: 2–5 sekme seç, sırasını değiştir. Üstte canlı önizleme.
 * Ayarlar her zaman kalır (yeri değiştirilebilir). Kişiseldir; tüm cihazlarda aynı.
 */
export function NavTabsEditor({ initial, onDone }: { initial: NavTabKey[]; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [tabs, setTabs] = useState<NavTabKey[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const full = tabs.length >= MAX_TABS;
  const available = NAV_TABS.filter((t) => !tabs.includes(t.key));

  const update = (next: NavTabKey[]) => {
    setError(null);
    setTabs(next);
  };
  const add = (key: NavTabKey) => {
    if (full) return;
    haptic("select");
    // Yeni sekme Ayarlar'ın önüne eklenir (Ayarlar sondaysa sonda kalsın).
    const at = tabs.at(-1) === REQUIRED_TAB ? tabs.length - 1 : tabs.length;
    update([...tabs.slice(0, at), key, ...tabs.slice(at)]);
  };
  const remove = (key: NavTabKey) => {
    if (key === REQUIRED_TAB || tabs.length <= MIN_TABS) return;
    haptic("tap");
    update(tabs.filter((k) => k !== key));
  };
  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= tabs.length) return;
    haptic("tap");
    const next = [...tabs];
    [next[i], next[j]] = [next[j]!, next[i]!];
    update(next);
  };

  const save = (value: NavTabKey[] | null, msg: string) =>
    startTransition(async () => {
      const res = await saveNavTabs(value).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) return setError(res.error);
      haptic("success");
      toast(msg);
      setOpen(false);
    });

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onExited={onDone}
      title="Alt menü"
      footer={
        <div className="flex gap-2 pb-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setTabs(DEFAULT_TABS);
              save(null, "Varsayılan menüye dönüldü");
            }}
            className="btn btn-ghost px-4 text-sm"
          >
            Varsayılan
          </button>
          <button type="button" disabled={pending} onClick={() => save(tabs, "Alt menü güncellendi")} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-5">
        {/* Canlı önizleme: telefonun alt çubuğu */}
        <div className="overflow-hidden rounded-2xl border border-line bg-bg">
          <div className="h-10 bg-[repeating-linear-gradient(90deg,var(--surface-2)_0_1px,transparent_1px_16px)] opacity-40" />
          <div
            className="grid border-t border-line bg-surface/80 px-1 pb-2 pt-1.5"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((key, i) => {
              const Icon = NAV_ICONS[key];
              return (
                <span
                  key={key}
                  className={cn("flex min-w-0 flex-col items-center gap-1 py-1 text-[10px] font-medium", i === 0 ? "text-ink" : "text-ink-3")}
                >
                  <Icon size={20} strokeWidth={i === 0 ? 2.25 : 1.6} />
                  <span className="max-w-full truncate">{navTab(key).label}</span>
                </span>
              );
            })}
          </div>
        </div>

        <section>
          <p className="eyebrow mb-2 flex justify-between">
            <span>Alt çubuktakiler</span>
            <span className="num">
              {tabs.length}/{MAX_TABS}
            </span>
          </p>
          <ul className="space-y-2">
            {tabs.map((key, i) => {
              const Icon = NAV_ICONS[key];
              const label = navTab(key).label;
              const locked = key === REQUIRED_TAB;
              return (
                <li key={key} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
                  <button
                    type="button"
                    onClick={() => remove(key)}
                    disabled={locked || tabs.length <= MIN_TABS}
                    aria-label={locked ? `${label}: her zaman görünür` : `${label}: kaldır`}
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
                      locked ? "bg-surface-2 text-ink-3" : "bg-expense/12 text-expense hover:bg-expense/20 disabled:opacity-30",
                    )}
                  >
                    {locked ? <Lock size={14} /> : <Minus size={16} />}
                  </button>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {label}
                    {locked && <span className="ml-1.5 text-[11px] font-normal text-ink-3">kaldırılamaz</span>}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`${label}: sola taşı`}
                      className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-25"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === tabs.length - 1}
                      aria-label={`${label}: sağa taşı`}
                      className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-25"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {available.length > 0 && (
          <section>
            <p className="eyebrow mb-2">{full ? "Eklemek için önce bir sekme çıkar" : "Eklenebilir"}</p>
            <ul className="grid grid-cols-2 gap-2">
              {available.map((t) => {
                const Icon = NAV_ICONS[t.key];
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => add(t.key)}
                      disabled={full}
                      className="flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-line p-2.5 text-left text-sm transition-colors hover:bg-surface-2 disabled:opacity-40"
                    >
                      <Icon size={17} className="shrink-0 text-ink-2" />
                      <span className="min-w-0 flex-1 truncate">{t.label}</span>
                      <Plus size={15} className="shrink-0 text-ink-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-xs leading-relaxed text-ink-3">
          En az {MIN_TABS}, en fazla {MAX_TABS} sekme. Burada olmayan sayfalara masaüstünde yan menüden, telefonda
          Ayarlar’daki kısayollardan ulaşabilirsin.
        </p>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
