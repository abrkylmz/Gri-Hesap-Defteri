"use client";

import Link from "next/link";
import { ArrowRight, Check, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { importContext, importTransactions } from "@/lib/actions/import";
import { dayMonthShort, monthOf } from "@/lib/dates";
import {
  buildRows,
  decodeText,
  detectMapping,
  dupKey,
  guessExpenseIsNegative,
  parseCsv,
  suggestCategory,
  type Cell,
  type Grid,
  type ImportRow,
  type Mapping,
} from "@/lib/statement";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { cn, Money, Notice, Spinner } from "@/components/ui";

type Review = ImportRow & { include: boolean; duplicate: boolean; categoryId: string | null };

/** Dosyayı ızgaraya çevirir: .xlsx, CSV, ya da bankaların "Excel" diye verdiği HTML tablo. */
async function readGrid(file: File): Promise<Grid> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Grid;
  }
  const text = decodeText(await file.arrayBuffer());
  if (/<table[\s>]/i.test(text)) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    return [...doc.querySelectorAll("tr")].map((tr) =>
      [...tr.querySelectorAll("th,td")].map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
  }
  if (name.endsWith(".xls")) {
    throw new Error("Eski .xls biçimi okunamıyor. Dosyayı Excel'de açıp .xlsx ya da .csv olarak kaydet.");
  }
  return parseCsv(text);
}

const cellLabel = (c: Cell | undefined) =>
  c instanceof Date ? c.toLocaleDateString("tr-TR") : c === null || c === undefined ? "" : String(c);

export function ImportView() {
  const { categories, currency } = useApp();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [expenseIsNegative, setExpenseIsNegative] = useState(true);
  const [rows, setRows] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ count: number; month: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setFileName(null);
    setGrid(null);
    setMapping(null);
    setRows(null);
    setError(null);
    setDone(null);
    if (input.current) input.current.value = "";
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    startTransition(async () => {
      try {
        const g = await readGrid(file);
        const m = detectMapping(g);
        if (!m) {
          setError("Dosyada tarih ve tutar sütunu bulunamadı. Bankanın hesap hareketleri dökümünü (CSV/Excel) seç.");
          return;
        }
        const negative = guessExpenseIsNegative(g, m);
        setGrid(g);
        setMapping(m);
        setExpenseIsNegative(negative);
        await review(g, m, negative);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Dosya okunamadı.");
      }
    });
  };

  /** Satırları üret, defterdekilerle karşılaştır, kategori öner. */
  const review = async (g: Grid, m: Mapping, negative: boolean) => {
    const built = buildRows(g, m, negative);
    if (built.length === 0) {
      setRows([]);
      return;
    }
    const dates = built.map((r) => r.date).sort();
    const ctx = await importContext(dates[0]!, dates.at(-1)!).catch(() => null);
    const existing = new Set(ctx && ctx.ok ? ctx.existing : []);
    const history = ctx && ctx.ok ? ctx.history : [];
    setRows(
      built.map((r) => {
        const duplicate = existing.has(dupKey(r.date, r.amount, r.kind));
        return { ...r, duplicate, include: !duplicate, categoryId: suggestCategory(r, categories, history) };
      }),
    );
  };

  const remap = (patch: Partial<Mapping>, negative = expenseIsNegative) => {
    if (!grid || !mapping) return;
    const next = { ...mapping, ...patch };
    setMapping(next);
    setExpenseIsNegative(negative);
    startTransition(() => review(grid, next, negative));
  };

  const selected = useMemo(() => (rows ?? []).filter((r) => r.include), [rows]);
  const totals = selected.reduce(
    (t, r) => ({ ...t, [r.kind]: t[r.kind] + r.amount }),
    { income: 0, expense: 0 } as Record<"income" | "expense", number>,
  );
  const dupCount = (rows ?? []).filter((r) => r.duplicate).length;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await importTransactions(
        selected.map((r) => ({ date: r.date, amount: r.amount, kind: r.kind, note: r.note, categoryId: r.categoryId })),
      ).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) return setError(res.error);
      const latest = selected.map((r) => r.date).sort().at(-1)!;
      setDone({ count: selected.length, month: monthOf(latest) });
      toast(`${selected.length} kayıt deftere eklendi`);
    });

  const header = grid && mapping?.headerRow !== null && mapping ? grid[mapping.headerRow!] : null;
  const width = grid ? Math.max(...grid.map((r) => r.length)) : 0;
  const sample = grid && mapping ? grid[(mapping.headerRow ?? -1) + 1] : null;
  const colOptions = Array.from({ length: width }, (_, i) => ({
    value: i,
    label: `${cellLabel(header?.[i]) || `Sütun ${i + 1}`}${sample?.[i] !== undefined ? ` — ör. ${cellLabel(sample[i]).slice(0, 24)}` : ""}`,
  }));
  const set = (i: number, patch: Partial<Review>) =>
    setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (done) {
    return (
      <div className="mx-auto max-w-3xl px-5 lg:px-10">
        <PageHeader eyebrow="Verilerin" title="İçe aktarıldı" />
        <div className="card rise mt-8 flex flex-col items-center gap-4 px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-income-fill text-on-fill">
            <Check size={28} strokeWidth={3} />
          </span>
          <p className="font-serif text-3xl">{done.count} kayıt deftere eklendi.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/?ay=${done.month}`} className="btn btn-primary">
              Deftere git <ArrowRight size={16} />
            </Link>
            <button type="button" onClick={reset} className="btn btn-ghost">
              Başka dosya
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 lg:px-10">
      <PageHeader eyebrow="Verilerin" title="Ekstre içe aktar">
        Bankanın internet şubesinden indirdiğin hesap ya da kredi kartı hareketlerini (CSV, Excel) yükle; kayıtlar
        kategorileriyle birlikte deftere eklenir.
      </PageHeader>

      {/* 1. Dosya */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files[0]);
        }}
        className="rise mt-8 flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line px-6 py-10 text-center transition-colors hover:border-ink-3 hover:bg-surface"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-surface-2">
          {pending && !rows ? <Spinner /> : fileName ? <FileSpreadsheet size={22} /> : <Upload size={22} />}
        </span>
        <span className="font-medium">{fileName ?? "Dosya seç ya da buraya bırak"}</span>
        <span className="text-xs text-ink-3">CSV, .xlsx ya da bankanın “Excel” dökümü · en fazla 2.000 satır</span>
        <input
          ref={input}
          type="file"
          accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {/* 2. Sütunlar */}
      {grid && mapping && (
        <section className="card rise mt-6 space-y-4 p-5" aria-label="Sütunlar">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Sütunlar</h2>
            <button type="button" onClick={reset} className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
              <RotateCcw size={13} /> Baştan
            </button>
          </div>
          <p className="text-xs text-ink-3">Otomatik tahmin edildi; yanlışsa düzelt.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ColumnSelect label="Tarih" value={mapping.date} options={colOptions} onChange={(date) => remap({ date })} />
            <ColumnSelect
              label="Açıklama"
              value={mapping.description}
              options={colOptions}
              onChange={(description) => remap({ description })}
            />
            {mapping.amount !== null ? (
              <ColumnSelect label="Tutar" value={mapping.amount} options={colOptions} onChange={(amount) => remap({ amount })} />
            ) : (
              <>
                <ColumnSelect label="Borç (gider)" value={mapping.debit!} options={colOptions} onChange={(debit) => remap({ debit })} />
                <ColumnSelect label="Alacak (gelir)" value={mapping.credit!} options={colOptions} onChange={(credit) => remap({ credit })} />
              </>
            )}
          </div>
          {mapping.amount !== null && (
            <div className="grid grid-cols-1 gap-2 rounded-2xl bg-surface-2 p-1 text-sm sm:grid-cols-2">
              {(
                [
                  [true, "Eksi tutarlar gider (banka hesabı)"],
                  [false, "Artı tutarlar gider (kredi kartı)"],
                ] as const
              ).map(([neg, label]) => (
                <button
                  key={String(neg)}
                  type="button"
                  onClick={() => remap({}, neg)}
                  aria-pressed={expenseIsNegative === neg}
                  className={cn(
                    "h-10 rounded-xl px-3 font-medium transition-all",
                    expenseIsNegative === neg ? "bg-surface text-ink shadow-sm" : "text-ink-3",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Satırlar */}
      {rows && (
        <section className="rise mt-6" aria-label="Satırlar">
          {rows.length === 0 ? (
            <Notice tone="error">Seçilen sütunlarla hiç hareket okunamadı. Sütunları kontrol et.</Notice>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl">
                  {rows.length} hareket <span className="text-base text-ink-3">· {selected.length} seçili</span>
                </h2>
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-ink-2 hover:text-ink" onClick={() => setRows(rows.map((r) => ({ ...r, include: true })))}>
                    Tümünü seç
                  </button>
                  <button type="button" className="text-ink-2 hover:text-ink" onClick={() => setRows(rows.map((r) => ({ ...r, include: false })))}>
                    Hiçbiri
                  </button>
                </div>
              </div>
              {dupCount > 0 && (
                <p className="mt-2 text-xs text-ink-3">
                  {dupCount} hareket defterde zaten var gibi görünüyor (aynı gün, aynı tutar); işaretsiz bırakıldı.
                </p>
              )}

              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
                {rows.map((r, i) => {
                  const cats = categories.filter((c) => c.kind === r.kind);
                  return (
                    <li key={r.key} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", !r.include && "opacity-50")}>
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => set(i, { include: e.target.checked })}
                        className="size-5 shrink-0 accent-[var(--ink)]"
                        aria-label={`${r.note || "Hareket"} dahil`}
                      />
                      <span className="num w-14 shrink-0 text-xs text-ink-3">{dayMonthShort(r.date)}</span>
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="block truncate text-sm">{r.note || "—"}</span>
                        {r.duplicate && <span className="text-[11px] text-amber-600 dark:text-amber-400">muhtemelen zaten var</span>}
                      </span>
                      <select
                        className="input h-9 w-40 shrink-0 px-2 text-xs"
                        value={r.categoryId ?? ""}
                        onChange={(e) => set(i, { categoryId: e.target.value || null })}
                        aria-label="Kategori"
                      >
                        <option value="">{UNCATEGORIZED.name}</option>
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.emoji} {c.name}
                          </option>
                        ))}
                      </select>
                      <Money
                        minor={r.kind === "expense" ? -r.amount : r.amount}
                        currency={currency}
                        sign
                        className={cn("w-28 shrink-0 text-right text-sm", r.kind === "income" && "text-income")}
                      />
                    </li>
                  );
                })}
              </ul>

              <div className="sticky bottom-24 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
                <span className="min-w-0 flex-1 text-sm text-ink-2">
                  {selected.length} kayıt · gider{" "}
                  <Money minor={totals.expense} currency={currency} className="text-ink" /> · gelir{" "}
                  <Money minor={totals.income} currency={currency} className="text-income" />
                </span>
                <button type="button" onClick={submit} disabled={pending || selected.length === 0} className="btn btn-primary">
                  {pending ? <Spinner /> : <Check size={17} />} Deftere ekle
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      <select className="input h-11 text-sm" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
