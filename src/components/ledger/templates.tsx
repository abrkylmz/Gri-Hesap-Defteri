"use client";

import { Check, Pencil, Plus, Table2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { applyTemplate, deleteTemplate, saveTemplate } from "@/lib/actions/entries";
import type { ActionResult } from "@/lib/action-utils";
import { dateInMonth, dayMonthShort, dayOf, monthName, monthOf } from "@/lib/dates";
import { formatMoney, minorToInput, toMinor } from "@/lib/money";
import type { EntryKind, Template, TemplateItem, TransactionRow } from "@/lib/types";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Money, Spinner } from "@/components/ui";
import { AppIcon } from "@/components/category-icon";

type State =
  | { kind: "list" }
  | { kind: "apply"; template: Template }
  | { kind: "edit"; template?: Template; fromMonth?: boolean };

type SheetProps = { open: boolean; onClose: () => void; onExited: () => void };

const totalOf = (items: { kind: EntryKind; amount: number | null }[]) =>
  items.reduce((s, i) => s + (i.amount === null ? 0 : i.kind === "expense" ? -i.amount : i.amount), 0);
const emptyOf = (items: { amount: number | null }[]) => items.filter((i) => i.amount === null).length;
/** "3 kalem · −19.350 ₺ + 1 tutarı boş" */
const summary = (items: { kind: EntryKind; amount: number | null }[], currency: string) => {
  const empty = emptyOf(items);
  return `${items.length} kalem · ${formatMoney(totalOf(items), currency, { sign: true })}${empty ? ` + ${empty} tutarı boş` : ""}`;
};

/** Şablon çekmecelerini yöneten hook: listeden açılır, uygulama ve düzenleme ekranlarına geçer. */
export function useTemplateSheets({
  month,
  transactions,
  templates,
}: {
  month: string;
  transactions: TransactionRow[];
  templates: Template[];
}) {
  const sheet = useSheetState<State>();
  const common = { open: sheet.open, onClose: sheet.close, onExited: sheet.exited };
  const item = sheet.item;

  const element = !item ? null : item.kind === "list" ? (
    <TemplateList
      {...common}
      month={month}
      templates={templates}
      onApply={(t) => sheet.show({ kind: "apply", template: t })}
      onEdit={(t) => sheet.show({ kind: "edit", template: t })}
      onCreateFromMonth={() => sheet.show({ kind: "edit", fromMonth: true })}
      onCreateEmpty={() => sheet.show({ kind: "edit" })}
    />
  ) : item.kind === "apply" ? (
    <ApplySheet {...common} month={month} template={item.template} />
  ) : (
    <TemplateEditor
      {...common}
      month={month}
      template={item.template}
      seed={item.fromMonth ? transactions : undefined}
    />
  );

  return {
    element,
    openList: () => sheet.show({ kind: "list" }),
    openApply: (t: Template) => sheet.show({ kind: "apply", template: t }),
  };
}

// ─── Defter üstündeki öneri ─────────────────────────────────────────────

/** Bu ay henüz uygulanmamış bir şablon varsa, ayın başında hatırlatır (ay için kapatılabilir). */
export function TemplatePrompt({
  month,
  templates,
  onApply,
}: {
  month: string;
  templates: Template[];
  onApply: (t: Template) => void;
}) {
  const { today, currency } = useApp();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const key = (t: Template) => `gri:tpl-prompt:${month}:${t.id}`;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnızca istemcide okunabilir
      setDismissed(new Set(templates.filter((t) => localStorage.getItem(key(t))).map((t) => t.id)));
    } catch {
      /* yok say */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, templates]);

  // Geçmiş aylara önerme; yalnızca bu ay ve sonrası.
  const candidate =
    month >= monthOf(today)
      ? templates.find((t) => t.appliedCount === 0 && t.items.length > 0 && !dismissed.has(t.id))
      : undefined;
  if (!candidate) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(key(candidate), "1");
    } catch {
      /* yok say */
    }
    setDismissed((d) => new Set(d).add(candidate.id));
  };

  return (
    <div className="rise mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">
        <Table2 size={16} />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">“{candidate.name}”</span> şablonunu{" "}
        <span className="capitalize">{monthName(month)}</span> ayına uygula
        <span className="block text-xs text-ink-3">
          {summary(candidate.items, currency)}
        </span>
      </p>
      <button type="button" onClick={() => onApply(candidate)} className="btn btn-primary h-9 shrink-0 px-4 text-sm">
        Uygula
      </button>
      <button type="button" onClick={dismiss} aria-label="Bu ay için gizle" className="shrink-0 text-ink-3 hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Liste ──────────────────────────────────────────────────────────────

function TemplateList({
  month,
  templates,
  onApply,
  onEdit,
  onCreateFromMonth,
  onCreateEmpty,
  ...sheet
}: SheetProps & {
  month: string;
  templates: Template[];
  onApply: (t: Template) => void;
  onEdit: (t: Template) => void;
  onCreateFromMonth: () => void;
  onCreateEmpty: () => void;
}) {
  const { currency } = useApp();
  return (
    <Sheet {...sheet} title="Şablonlar">
      <div className="space-y-5 pb-6">
        <p className="text-sm text-ink-2">
          Bir ayın giderlerini tablo olarak kaydet; başka bir ayda tek dokunuşla uygula. Uygulanan kalemler
          deftere <strong>ödenmemiş</strong> olarak düşer, ödedikçe ✓ ile işaretlersin.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onCreateFromMonth} className="btn btn-primary w-full">
            <Table2 size={17} /> <span className="capitalize">{monthName(month)}</span> ayını kaydet
          </button>
          <button type="button" onClick={onCreateEmpty} className="btn btn-ghost w-full">
            <Plus size={17} /> Boş şablon
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-3">
            Henüz şablon yok.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block text-xs text-ink-3">
                    {summary(t.items, currency)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
                  aria-label={`${t.name} düzenle`}
                >
                  <Pencil size={15} />
                </button>
                {t.appliedCount > 0 ? (
                  <span className="flex h-9 items-center gap-1 rounded-full bg-income-fill/15 px-3 text-xs font-medium text-income">
                    <Check size={13} /> <span className="capitalize">{monthName(month)}</span>’de var
                  </span>
                ) : (
                  <button type="button" onClick={() => onApply(t)} className="btn btn-primary h-9 px-3 text-xs">
                    <span className="capitalize">{monthName(month)}</span> ayına uygula
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

// ─── Uygula ─────────────────────────────────────────────────────────────

function ApplySheet({ month, template, ...sheet }: SheetProps & { month: string; template: Template }) {
  const { currency, categoryById } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(() =>
    template.items.map((it) => ({ item: it, include: true, amount: it.amount === null ? "" : minorToInput(it.amount) })),
  );

  const chosen = rows.filter((r) => r.include);
  // Boş bırakılan tutar serbest ("tutar bekleniyor" olarak eklenir); yazıldıysa geçerli olmalı.
  const invalidRows = chosen.filter((r) => r.amount.trim() && !toMinor(r.amount));
  const pendingCount = chosen.filter((r) => !r.amount.trim()).length;
  const total = chosen.reduce((s, r) => {
    const a = toMinor(r.amount) ?? 0;
    return s + (r.item.kind === "expense" ? -a : a);
  }, 0);

  const submit = () => {
    if (chosen.length === 0) return setError("En az bir satır seç.");
    if (invalidRows.length) {
      const names = invalidRows.map((r) => r.item.note || categoryById.get(r.item.category_id ?? "")?.name || "Kategorisiz");
      return setError(`Geçersiz tutar: ${names.join(", ")}`);
    }
    startTransition(async () => {
      const res = await applyTemplate({
        templateId: template.id,
        month,
        items: chosen.map((r) => ({ itemId: r.item.id, amount: r.amount.trim() ? toMinor(r.amount)! : null })),
      }).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) return setError(res.error);
      toast(`${chosen.length} kayıt ${monthName(month)} ayına eklendi`);
      sheet.onClose();
    });
  };

  return (
    <Sheet
      {...sheet}
      title={`${template.name} → ${monthName(month)}`}
      footer={
        <div className="flex items-center gap-3 pb-1">
          <span className="min-w-0 flex-1 text-sm text-ink-2">
            {chosen.length} kalem · <Money minor={total} currency={currency} sign className="text-ink" />
            {pendingCount > 0 && <span className="block text-xs text-ink-3">+ {pendingCount} tutarı sonra girilecek</span>}
          </span>
          <button type="button" onClick={submit} disabled={pending} className="btn btn-primary">
            {pending ? <Spinner /> : <Check size={17} />} Deftere ekle
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-5">
        <p className="text-sm text-ink-2">
          Bu ay farklı olan tutarları düzelt, istemediklerinin işaretini kaldır. Henüz belli olmayan tutarları boş
          bırakabilirsin: “tutar bekleniyor” olarak eklenir, belli olunca deftere dokunup girersin.
        </p>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {rows.map((r, i) => {
            const cat = r.item.category_id ? categoryById.get(r.item.category_id) : undefined;
            return (
              <li key={r.item.id} className={cn("flex items-center gap-3 px-3 py-2.5", !r.include && "opacity-45")}>
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                  className="size-5 shrink-0 accent-[var(--ink)]"
                  aria-label={`${r.item.note || cat?.name || "Satır"} dahil`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    <AppIcon name={cat?.emoji} size={15} className="mr-1 inline-block align-[-2px] text-ink-2" />{r.item.note || cat?.name || UNCATEGORIZED.name}
                  </span>
                  <span className="num block text-xs text-ink-3">
                    {dayMonthShort(dateInMonth(month, r.item.day_of_month))}
                    {r.item.kind === "income" && " · gelir"}
                  </span>
                </span>
                <input
                  className={cn(
                    "input num h-10 w-28 shrink-0 text-right text-sm",
                    r.include && r.amount.trim() && !toMinor(r.amount) && "border-expense",
                  )}
                  inputMode="decimal"
                  placeholder="Sonra gir"
                  value={r.amount}
                  disabled={!r.include}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  aria-label="Tutar"
                />
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ─── Tablo düzenleyici ──────────────────────────────────────────────────

type Row = { key: number; kind: EntryKind; categoryId: string; note: string; day: string; amount: string };
let rowSeq = 0;
const newRow = (p: Partial<Row> = {}): Row => ({
  key: ++rowSeq,
  kind: "expense",
  categoryId: "",
  note: "",
  day: "1",
  amount: "",
  ...p,
});
const fromItem = (it: TemplateItem): Row =>
  newRow({
    kind: it.kind,
    categoryId: it.category_id ?? "",
    note: it.note ?? "",
    day: String(it.day_of_month),
    amount: it.amount === null ? "" : minorToInput(it.amount),
  });

function TemplateEditor({
  month,
  template,
  seed,
  ...sheet
}: SheetProps & { month: string; template?: Template; seed?: TransactionRow[] }) {
  const { categories, currency } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(template?.name ?? (seed ? "Aylık giderler" : ""));
  const [rows, setRows] = useState<Row[]>(() => {
    if (template) return template.items.map(fromItem);
    if (seed) {
      // Bu ayın giderleri, tarih sırasıyla (gelirleri istersen satır ekleyerek koyarsın).
      const expenses = [...seed]
        .filter((t) => t.kind === "expense")
        .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
      return expenses.length
        ? expenses.map((t) =>
            newRow({
              categoryId: t.category_id ?? "",
              note: t.note ?? "",
              day: String(dayOf(t.occurred_on)),
              amount: t.amount === null ? "" : minorToInput(t.amount),
            }),
          )
        : [newRow()];
    }
    return [newRow()];
  });

  const byKind = useMemo(
    () => ({
      expense: categories.filter((c) => c.kind === "expense"),
      income: categories.filter((c) => c.kind === "income"),
    }),
    [categories],
  );

  const set = (key: number, patch: Partial<Row>) => {
    setError(null);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const total = rows.reduce((s, r) => {
    const a = toMinor(r.amount) ?? 0;
    return s + (r.kind === "expense" ? -a : a);
  }, 0);
  const emptyRows = rows.filter((r) => !r.amount.trim() && (r.note.trim() || r.categoryId)).length;

  const run = (fn: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const res = await fn().catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) return setError(res.error);
      toast(success);
      sheet.onClose();
    });

  const save = () => {
    if (!name.trim()) return setError("Şablona bir ad ver.");
    const filled = rows.filter((r) => r.amount.trim() || r.note.trim() || r.categoryId);
    if (filled.length === 0) return setError("En az bir satır doldur.");
    const items: { kind: EntryKind; amount: number | null; categoryId: string | null; note: string; dayOfMonth: number }[] =
      [];
    for (const [i, r] of filled.entries()) {
      // Tutar boş bırakılabilir (her ay değişen kalemler); yazıldıysa geçerli olmalı.
      const amount = r.amount.trim() ? toMinor(r.amount) : null;
      const day = Number(r.day);
      if (r.amount.trim() && !amount) return setError(`${i + 1}. satırın tutarı geçersiz.`);
      if (!amount && !r.note.trim() && !r.categoryId) {
        return setError(`${i + 1}. satıra en azından bir açıklama ya da kategori yaz.`);
      }
      if (!Number.isInteger(day) || day < 1 || day > 31) return setError(`${i + 1}. satırın günü 1-31 olmalı.`);
      items.push({ kind: r.kind, amount, categoryId: r.categoryId || null, note: r.note, dayOfMonth: day });
    }
    run(() => saveTemplate({ id: template?.id, name, items }), template ? "Şablon güncellendi" : "Şablon kaydedildi");
  };

  return (
    <Sheet
      {...sheet}
      wide
      title={template ? "Şablonu düzenle" : "Yeni şablon"}
      footer={
        <div className="flex gap-2 pb-1">
          {template && (
            <ConfirmButton
              disabled={pending}
              confirmText="Silinsin mi?"
              onConfirm={() => run(() => deleteTemplate(template.id), "Şablon silindi")}
            >
              <Trash2 size={16} />
            </ConfirmButton>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-5">
        <input
          className="input"
          placeholder="Şablon adı (ör. Ev giderleri)"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          aria-label="Şablon adı"
        />
        {seed && (
          <p className="text-xs text-ink-3">
            <span className="capitalize">{monthName(month)}</span> ayının giderleriyle dolduruldu. İstemediğin satırları
            sil, tutarları düzelt.
          </p>
        )}

        {/* Masaüstünde tablo başlığı */}
        <div className="hidden grid-cols-[6rem_12rem_1fr_4rem_8rem_2.5rem] gap-2 px-1 text-[11px] font-medium text-ink-3 sm:grid">
          <span>Tür</span>
          <span>Kategori</span>
          <span>Açıklama</span>
          <span>Gün</span>
          <span className="text-right">Tutar</span>
          <span />
        </div>

        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className="grid grid-cols-[1fr_1fr_2rem] gap-2 rounded-2xl border border-line p-2 sm:grid-cols-[6rem_12rem_1fr_4rem_8rem_2.5rem] sm:items-center sm:rounded-xl sm:border-0 sm:p-0"
            >
              <select
                className="input h-10 px-2 text-sm"
                value={r.kind}
                onChange={(e) => set(r.key, { kind: e.target.value as EntryKind, categoryId: "" })}
                aria-label="Tür"
              >
                <option value="expense">Gider</option>
                <option value="income">Gelir</option>
              </select>
              <select
                className="input h-10 px-2 text-sm"
                value={r.categoryId}
                onChange={(e) => set(r.key, { categoryId: e.target.value })}
                aria-label="Kategori"
              >
                <option value="">Kategorisiz</option>
                {byKind[r.kind].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}
                className="grid size-10 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-expense sm:order-last"
                aria-label="Satırı sil"
              >
                <X size={16} />
              </button>
              <input
                className="input col-span-3 h-10 text-sm sm:col-span-1"
                placeholder="Açıklama (ör. Kira)"
                value={r.note}
                maxLength={200}
                onChange={(e) => set(r.key, { note: e.target.value })}
                aria-label="Açıklama"
              />
              <label className="relative col-span-1 sm:col-span-1">
                <input
                  className="input num h-10 pr-2 pl-9 text-sm sm:pl-2"
                  inputMode="numeric"
                  value={r.day}
                  maxLength={2}
                  onChange={(e) => set(r.key, { day: e.target.value.replace(/\D/g, "") })}
                  aria-label="Ayın günü"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-3 sm:hidden">
                  gün
                </span>
              </label>
              <input
                className={cn(
                  "input num col-span-2 h-10 text-right text-sm sm:col-span-1",
                  r.amount && !toMinor(r.amount) && "border-expense",
                )}
                inputMode="decimal"
                placeholder="Boş bırakılabilir"
                value={r.amount}
                onChange={(e) => set(r.key, { amount: e.target.value })}
                aria-label="Tutar"
              />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, newRow({ day: rs[rs.length - 1]?.day ?? "1" })])}
            className="btn btn-ghost h-10 text-sm"
          >
            <Plus size={16} /> Satır ekle
          </button>
          <span className="text-right text-sm text-ink-2">
            Toplam <Money minor={total} currency={currency} sign className="font-medium text-ink" />
            {emptyRows > 0 && <span className="block text-xs text-ink-3">+ {emptyRows} satırın tutarı boş</span>}
          </span>
        </div>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
