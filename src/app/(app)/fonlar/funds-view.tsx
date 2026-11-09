"use client";

import { LineChart, Plus, TrendingDown, TrendingUp, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteFund, deleteFundValue, saveFund, saveFundValue } from "@/lib/actions/funds";
import { dayMonth } from "@/lib/dates";
import { fundStats, fundTotals, type Fund, type FundStat, type FundValue } from "@/lib/funds";
import { haptic } from "@/lib/haptics";
import { minorToInput, toMinor } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { DateField } from "@/components/date-picker";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Field, Money, Spinner } from "@/components/ui";

const pctFmt = new Intl.NumberFormat("tr-TR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

type FundDraft = { id?: string; name: string; code: string; invested: string };
type ValueDraft = { fund: Fund; day: string; value: string };

/** Fon getiri takibi (yönetici): toplam değer, bir önceki güne göre ve toplam getiri; değerler elle girilir. */
export function FundsView({ funds, values, today }: { funds: Fund[]; values: FundValue[]; today: string }) {
  const { currency } = useApp();
  const stats = fundStats(funds, values);
  const t = fundTotals(stats);
  const fundSheet = useSheetState<FundDraft>();
  const valueSheet = useSheetState<ValueDraft>();
  const addFund = () => fundSheet.show({ name: "", code: "", invested: "" });
  const lastDay = stats.reduce<string | null>((m, s) => (s.day && (!m || s.day > m) ? s.day : m), null);

  return (
    <div className="mx-auto max-w-4xl px-5 pb-10 lg:px-10">
      <PageHeader
        eyebrow="Yönetici"
        title="Fon getirisi"
        action={
          <button type="button" onClick={addFund} className="btn btn-ghost h-10 text-sm">
            <Plus size={16} /> Fon ekle
          </button>
        }
      >
        Her fonun güncel değerini gir; bir önceki güne göre ve yatırdığına göre getiriyi hesaplayalım.
      </PageHeader>

      {funds.length === 0 ? (
        <div className="rise mt-8 rounded-3xl border border-dashed border-line p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky-500/12 text-sky-700 dark:text-sky-300">
            <LineChart size={26} />
          </span>
          <p className="mt-3 font-semibold">İlk fonunu ekle</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
            Fonun adını, kodunu (ör. AFT) ve toplam yatırdığın tutarı gir; sonra her gün güncel değerini yaz.
          </p>
          <button type="button" onClick={addFund} className="btn btn-primary mt-4 h-10 px-5 text-sm">
            <Plus size={16} /> Fon ekle
          </button>
        </div>
      ) : (
        <>
          {/* Özet */}
          <section className="card rise mt-6 p-4 sm:p-5" aria-label="Toplam">
            <p className="text-xs font-medium text-ink-3">
              Toplam değer{lastDay && <> · son giriş {lastDay === today ? "bugün" : dayMonth(lastDay)}</>}
            </p>
            <Money
              minor={t.value}
              currency={currency}
              fracClassName="opacity-40"
              className="mt-1 block text-[2rem] font-semibold leading-none tracking-tight"
            />
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Delta label="Bir önceki güne göre" amount={t.daily} ratio={t.dailyPct} />
              <Delta label="Toplam getiri" amount={t.total} ratio={t.totalPct} />
              <div className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
                <p className="text-[11px] font-medium text-ink-3">Yatırılan</p>
                <Money minor={t.invested} currency={currency} className="mt-0.5 block text-base font-semibold" />
              </div>
            </div>
          </section>

          {/* Fonlar */}
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {stats.map((s) => (
              <li key={s.fund.id}>
                <FundCard
                  stat={s}
                  onValue={() =>
                    valueSheet.show({
                      fund: s.fund,
                      day: today,
                      value: s.day === today && s.value !== null ? minorToInput(s.value) : "",
                    })
                  }
                  onEdit={() =>
                    fundSheet.show({
                      id: s.fund.id,
                      name: s.fund.name,
                      code: s.fund.code ?? "",
                      invested: s.fund.invested ? minorToInput(s.fund.invested) : "",
                    })
                  }
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            Günlük getiri, son girilen değerin bir önceki girişe göre farkıdır. O gün fona para eklediysen önce
            “Yatırılan” tutarı güncelle; yoksa eklenen para getiri gibi görünür.
          </p>
        </>
      )}

      {fundSheet.item && (
        <FundEditor
          initial={fundSheet.item}
          history={stats.find((s) => s.fund.id === fundSheet.item!.id)?.history ?? []}
          open={fundSheet.open}
          onClose={fundSheet.close}
          onExited={fundSheet.exited}
        />
      )}
      {valueSheet.item && (
        <ValueEditor
          initial={valueSheet.item}
          open={valueSheet.open}
          onClose={valueSheet.close}
          onExited={valueSheet.exited}
        />
      )}
    </div>
  );
}

function Delta({ label, amount, ratio }: { label: string; amount: number | null; ratio: number | null }) {
  const { currency } = useApp();
  const up = (amount ?? 0) >= 0;
  return (
    <div className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
      <p className="text-[11px] font-medium text-ink-3">{label}</p>
      {amount === null ? (
        <p className="mt-0.5 text-sm text-ink-3">En az iki gün değer gir</p>
      ) : (
        <p className={cn("mt-0.5 flex flex-wrap items-baseline gap-x-1.5", up ? "text-income" : "text-expense")}>
          {up ? <TrendingUp size={14} className="self-center" /> : <TrendingDown size={14} className="self-center" />}
          <Money minor={amount} currency={currency} sign className="text-base font-semibold" />
          {ratio !== null && <span className="num text-xs font-medium">{pctFmt.format(ratio)}</span>}
        </p>
      )}
    </div>
  );
}

function Sparkline({ history, up }: { history: { day: string; value: number }[]; up: boolean }) {
  if (history.length < 2) return null;
  const vals = history.map((h) => h.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 120;
  const H = 36;
  const pts = vals.map(
    (v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${(H - ((v - min) / span) * H).toFixed(1)}`,
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-9 w-28 shrink-0 overflow-visible"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={up ? "var(--income)" : "var(--expense)"}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function FundCard({ stat, onValue, onEdit }: { stat: FundStat; onValue: () => void; onEdit: () => void }) {
  const { currency, today } = useApp();
  const s = stat;
  // Grafiğin rengi gösterdiği dönemin yönüne göre (son gün düşse de 30 günde yükseldiyse yeşil)
  const spark = s.history.slice(-30);
  const up = spark.length > 1 ? spark.at(-1)!.value >= spark[0]!.value : true;
  return (
    <div className="card h-full p-4">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-3 text-left"
        aria-label={`${s.fund.name}: düzenle`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/12 text-[11px] font-bold text-sky-700 dark:text-sky-300">
          {(s.fund.code ?? s.fund.name).slice(0, 3).toLocaleUpperCase("tr")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{s.fund.name}</span>
          <span className="block text-xs text-ink-3">
            {s.value === null
              ? "Değer girilmedi"
              : s.day === today
                ? "bugün güncellendi"
                : `${dayMonth(s.day!)} değeri`}
          </span>
        </span>
        <Sparkline history={spark} up={up} />
      </button>
      {s.value !== null && (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Money minor={s.value} currency={currency} fracClassName="opacity-40" className="text-xl font-semibold" />
          <span className="flex flex-wrap gap-x-3 text-xs">
            {s.daily !== null && (
              <span className={s.daily >= 0 ? "text-income" : "text-expense"}>
                Gün <Money minor={s.daily} currency={currency} sign />
                {s.dailyPct !== null && ` (${pctFmt.format(s.dailyPct)})`}
              </span>
            )}
            {s.total !== null && s.fund.invested > 0 && (
              <span className={s.total >= 0 ? "text-income" : "text-expense"}>
                Toplam <Money minor={s.total} currency={currency} sign />
                {s.totalPct !== null && ` (${pctFmt.format(s.totalPct)})`}
              </span>
            )}
          </span>
        </div>
      )}
      <button type="button" onClick={onValue} className="btn btn-ghost mt-3 h-9 w-full text-sm">
        <Plus size={15} /> {s.day === today ? "Bugünün değerini güncelle" : "Bugünün değerini gir"}
      </button>
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const { currency } = useApp();
  return (
    <span className="relative block">
      <input
        className={cn("input num pr-12", value && toMinor(value) === null && value.trim() !== "0" && "border-expense")}
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
    </span>
  );
}

const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
  fn().catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));

function FundEditor({
  initial,
  history,
  open,
  onClose,
  onExited,
}: {
  initial: FundDraft;
  history: { day: string; value: number }[];
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const toast = useToast();
  const { currency } = useApp();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<FundDraft>) => {
    setError(null);
    setD((x) => ({ ...x, ...p }));
  };

  const save = () => {
    const invested = d.invested.trim() ? toMinor(d.invested) : 0;
    if (!d.name.trim()) return setError("Fonun adını yaz.");
    if (invested === null) return setError("Yatırılan tutar geçersiz.");
    start(async () => {
      const res = await run(() => saveFund({ id: d.id, name: d.name, code: d.code, invested }));
      if (!res.ok) return setError(res.error);
      haptic("success");
      toast(d.id ? "Fon güncellendi" : "Fon eklendi");
      onClose();
    });
  };
  const remove = () =>
    start(async () => {
      const res = await run(() => deleteFund(d.id!));
      if (!res.ok) return setError(res.error);
      toast("Fon silindi");
      onClose();
    });
  const removeValue = (day: string) =>
    start(async () => {
      const res = await run(() => deleteFundValue(d.id!, day));
      toast(res.ok ? "Değer silindi" : res.error, res.ok ? "default" : "error");
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={d.id ? "Fonu düzenle" : "Yeni fon"}
      footer={
        <div className="flex gap-2 pb-1">
          {d.id && (
            <ConfirmButton disabled={pending} confirmText="Sil" onConfirm={remove}>
              Sil
            </ConfirmButton>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-5">
        <Field label="Fonun adı">
          <input
            className="input"
            maxLength={60}
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="ör. Ak Portföy Teknoloji"
            autoFocus={!d.id}
          />
        </Field>
        <Field label="Fon kodu (isteğe bağlı)" hint="TEFAS kodu, ör. AFT">
          <input
            className="input uppercase"
            maxLength={12}
            value={d.code}
            onChange={(e) => set({ code: e.target.value })}
            placeholder="AFT"
            autoCapitalize="characters"
          />
        </Field>
        <Field
          label="Toplam yatırılan"
          hint="Fona koyduğun toplam para; toplam getiri buna göre hesaplanır. Para ekledikçe güncelle."
        >
          <MoneyInput value={d.invested} onChange={(invested) => set({ invested })} />
        </Field>
        {history.length > 0 && (
          <div>
            <p className="text-xs font-medium text-ink-3">Değer geçmişi</p>
            <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
              {[...history].reverse().map((h) => (
                <li key={h.day} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1 text-ink-2">{dayMonth(h.day)}</span>
                  <Money minor={h.value} currency={currency} />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeValue(h.day)}
                    aria-label={`${dayMonth(h.day)} değerini sil`}
                    className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-expense/10 hover:text-expense"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function ValueEditor({
  initial,
  open,
  onClose,
  onExited,
}: {
  initial: ValueDraft;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const toast = useToast();
  const [day, setDay] = useState(initial.day);
  const [value, setValue] = useState(initial.value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    const minorValue = value.trim() === "0" ? 0 : toMinor(value);
    if (minorValue === null) return setError("Geçerli bir tutar gir.");
    start(async () => {
      const res = await run(() => saveFundValue({ fundId: initial.fund.id, day, value: minorValue }));
      if (!res.ok) return setError(res.error);
      haptic("success");
      toast(`${initial.fund.name}: değer kaydedildi`);
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={initial.fund.name}
      subtitle="Fonun güncel toplam değeri"
      footer={
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary mb-1 w-full">
          {pending && <Spinner />} Kaydet
        </button>
      }
    >
      <div className="space-y-4 pb-5">
        <Field label="Tarih">
          <DateField value={day} onChange={setDay} ariaLabel="Tarih" />
        </Field>
        <Field
          label="Toplam değer"
          hint="Bankanın ya da aracı kurumun gösterdiği güncel fon değeri (pay adedi × fiyat)."
        >
          <MoneyInput
            value={value}
            onChange={(v) => {
              setError(null);
              setValue(v);
            }}
            autoFocus
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
