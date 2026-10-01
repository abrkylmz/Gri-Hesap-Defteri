"use client";

import { Check, ChevronDown, Pencil } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { setTransactionPaid } from "@/lib/actions/entries";
import { updateLoanInfo } from "@/lib/actions/loans";
import { dayMonth, dayMonthShort } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { LOAN_TYPES } from "@/lib/loan";
import type { LoanInstallment, LoanSummary } from "@/lib/types";
import { useApp } from "@/components/app-context";
import { BankPicker } from "@/components/assets/bank-picker";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, CountUpMoney, Field, Money, Spinner } from "@/components/ui";

const pctFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const rateFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

/** Ödenme oranı halkası */
function Ring({ ratio }: { ratio: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" className="size-36" role="img" aria-label={`Yüzde ${pctFmt.format(ratio * 100)} ödendi`}>
      <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-surface-2" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        className="stroke-violet-500 transition-[stroke-dashoffset] duration-700"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, ratio))}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="62" textAnchor="middle" className="fill-ink text-[26px] font-semibold">
        %{pctFmt.format(ratio * 100)}
      </text>
      <text x="64" y="82" textAnchor="middle" className="fill-ink-3 text-[11px]">
        Ödendi
      </text>
    </svg>
  );
}

/**
 * Kredi (borç) detayı: banka, tür, ödenme halkası, kalan borç, taksit bilgileri ve taksit listesi.
 * "Ödeme ekle" sıradaki ödenmemiş taksiti ödendi (✓) işaretler; listeden tek tek de işaretlenebilir.
 * Veriler sayfadan güncel gelir (kaydedince sayfa tazelenir).
 */
export function LoanDetail({
  loan,
  installments,
  open,
  onClose,
  onExited,
}: {
  loan: LoanSummary;
  installments: LoanInstallment[];
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const { currency } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  // ✓ anında görünsün (sunucu yanıtı beklenmeden)
  const [rows, setOptimistic] = useOptimistic(installments, (state, { id, paid }: { id: string; paid: boolean }) =>
    state.map((r) => (r.id === id ? { ...r, paid } : r)),
  );

  const paidSum = rows.filter((r) => r.paid).reduce((s, r) => s + (r.amount ?? 0), 0);
  const remaining = rows.filter((r) => !r.paid).reduce((s, r) => s + (r.amount ?? 0), 0);
  const total = paidSum + remaining;
  const paidCount = rows.filter((r) => r.paid).length;
  const next = rows.find((r) => !r.paid) ?? null;
  const type = loan.loan_type ? LOAN_TYPES[loan.loan_type].label : null;
  // "İhtiyaç kredisi · İhtiyaç kredisi" gibi tekrar olmasın: ad türle aynıysa bir kez yazılır.
  const typeText = type ? `${type} kredisi` : null;
  const subtitle =
    typeText && typeText.toLocaleLowerCase("tr") !== loan.name.trim().toLocaleLowerCase("tr")
      ? `${typeText} · ${loan.name}`
      : loan.name;
  const visibleRows = showAll ? rows : rows.filter((r) => !r.paid).slice(0, 4);

  const setPaid = (row: LoanInstallment, paid: boolean, msg: string) => {
    haptic(paid ? "success" : "tap");
    startTransition(async () => {
      setOptimistic({ id: row.id, paid });
      const res = await setTransactionPaid(row.id, paid).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı. Tekrar dene.",
      }));
      toast(res.ok ? msg : res.error, res.ok ? "default" : "error");
    });
  };

  return (
    <Sheet open={open} onClose={onClose} onExited={onExited} title="Kredi detayı" wide>
      <div className="space-y-5 pb-6">
        {/* Banka ve tür */}
        {editing ? (
          <InfoEditor loan={loan} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-base font-bold text-violet-700 dark:text-violet-300">
              {(loan.bank ?? loan.name).trim().charAt(0).toLocaleUpperCase("tr")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{loan.bank ?? "Banka eklenmedi"}</span>
              <span className="block truncate text-xs text-ink-3">{subtitle}</span>
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium hover:bg-surface-2"
            >
              <Pencil size={13} /> Düzenle
            </button>
          </div>
        )}

        {/* Halka + kalan borç */}
        <div className="flex flex-col items-center text-center">
          <Ring ratio={total > 0 ? paidSum / total : 0} />
          <p className="mt-2 text-xs text-ink-3">Kalan borç</p>
          <CountUpMoney
            id={`loan-${loan.id}`}
            minor={remaining}
            currency={currency}
            fracClassName="opacity-40"
            className="text-3xl font-semibold tracking-tight"
          />
        </div>

        {/* Bilgiler */}
        <dl className="divide-y divide-line rounded-2xl border border-line">
          <Info label="Aylık taksit">
            {next?.amount != null ? <Money minor={next.amount} currency={currency} /> : "—"}
          </Info>
          <Info label="Taksit sayısı">
            <span className="num">
              {paidCount} / {rows.length}
            </span>
          </Info>
          <Info label="Faiz oranı">
            {loan.monthly_rate !== null ? <span className="num">aylık %{rateFmt.format(loan.monthly_rate)}</span> : "—"}
          </Info>
          <Info label="Sonraki ödeme">{next ? <span className="capitalize">{dayMonth(next.occurred_on)}</span> : "Bitti ✓"}</Info>
          {loan.principal !== null && (
            <Info label="Çekilen tutar">
              <Money minor={loan.principal} currency={currency} />
            </Info>
          )}
          <Info label="Ödenen">
            <Money minor={paidSum} currency={currency} className="text-income" />
          </Info>
          <Info label="Toplam geri ödeme">
            <Money minor={total} currency={currency} />
          </Info>
        </dl>

        <button
          type="button"
          disabled={!next || pending}
          onClick={() => next && setPaid(next, true, `${next.installment_no ?? ""}. taksit ödendi`)}
          className="btn w-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {pending ? <Spinner /> : <Check size={18} strokeWidth={2.5} />}
          {next ? `Ödeme ekle · ${next.installment_no ?? ""}. taksit` : "Tüm taksitler ödendi"}
        </button>

        {/* Taksitler */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">{showAll ? "Tüm taksitler" : "Sıradaki taksitler"}</p>
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
            >
              {showAll ? "Daha az" : `Tümü (${rows.length})`}
              <ChevronDown size={14} className={cn("transition-transform", showAll && "rotate-180")} />
            </button>
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {visibleRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={r.paid}
                  aria-label={`${r.installment_no}. taksit: ${r.paid ? "ödenmedi yap" : "ödendi işaretle"}`}
                  disabled={pending}
                  onClick={() =>
                    setPaid(r, !r.paid, r.paid ? `${r.installment_no}. taksit ödenmedi` : `${r.installment_no}. taksit ödendi`)
                  }
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    r.paid ? "border-income bg-income text-bg" : "border-line text-transparent hover:border-ink-3",
                  )}
                >
                  <Check size={14} strokeWidth={3} />
                </button>
                <span className="num w-10 shrink-0 text-xs text-ink-3">
                  {r.installment_no}/{rows.length}
                </span>
                <span className={cn("flex-1 text-sm", r.paid && "text-ink-3 line-through")}>{dayMonthShort(r.occurred_on)}</span>
                {r.amount !== null && (
                  <Money minor={r.amount} currency={currency} className={cn("text-sm", r.paid && "text-ink-3")} />
                )}
              </li>
            ))}
            {visibleRows.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">Ödenmemiş taksit kalmadı.</li>}
          </ul>
        </section>
      </div>
    </Sheet>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Kredinin adını ve bankasını düzenleme (detay içinde). */
function InfoEditor({ loan, onDone }: { loan: LoanSummary; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(loan.name);
  const [bank, setBank] = useState(loan.bank ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const res = await updateLoanInfo({ id: loan.id, name, bank }).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı. Tekrar dene.",
      }));
      if (!res.ok) return setError(res.error);
      toast("Kredi bilgileri güncellendi");
      onDone();
    });
  return (
    <div className="space-y-4 rounded-2xl border border-line p-4">
      <div>
        <p className="eyebrow mb-2">Banka</p>
        <BankPicker value={bank} onChange={setBank} mine={[]} />
      </div>
      <Field label="Kredinin adı">
        <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-expense">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn btn-ghost">
          Vazgeç
        </button>
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
          {pending && <Spinner />} Kaydet
        </button>
      </div>
    </div>
  );
}
