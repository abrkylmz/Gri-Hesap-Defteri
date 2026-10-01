"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Landmark, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createLoan, deleteLoan } from "@/lib/actions/loans";
import { addMonths, dateInMonth, dayMonthShort, dayOf, monthLabel, monthOf } from "@/lib/dates";
import {
  annualCostRate,
  annuitySchedule,
  dueDates,
  fixedSchedule,
  LOAN_TYPES,
  type LoanType,
  type Schedule,
} from "@/lib/loan";
import { moneyParts, toMinor } from "@/lib/money";
import type { LoanInstallment, LoanSummary } from "@/lib/types";
import { BankPicker } from "@/components/assets/bank-picker";
import { LoanDetail } from "./loan-detail";
import { DEFAULT_REMIND_DAYS } from "@/lib/validation";
import { useApp } from "@/components/app-context";
import { DateField } from "@/components/date-picker";
import { PageHeader } from "@/components/page-header";
import { RemindPicker } from "@/components/remind-picker";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Field, Money, Spinner, Switch } from "@/components/ui";

const pctFmt = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("tr-TR");
/** "3,49" / "3.49" → 3.49; geçersizse null */
const parseRate = (s: string) => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
const parseMonths = (s: string) => {
  const n = Number(s.trim());
  return Number.isInteger(n) && n >= 1 && n <= 480 ? n : null;
};

type Plan = {
  type: LoanType;
  principal: number | null;
  rate: number | null;
  kkdf: number;
  bsmv: number;
  months: number;
  installment: number | null;
  schedule: Schedule;
};

export function LoanView({ loans, installments }: { loans: LoanSummary[]; installments: LoanInstallment[] }) {
  const sheet = useSheetState<Plan>();
  // Detayda gösterilen kredi: id tutulur, veriler her çizimde sayfadan güncel okunur.
  const detail = useSheetState<string>();
  const detailLoan = detail.item ? loans.find((l) => l.id === detail.item) : undefined;

  return (
    <div className="mx-auto max-w-5xl px-5 lg:px-10">
      <PageHeader eyebrow="Borç ve hesap" title="Kredi">
        Krediyi hesapla, beğenirsen deftere ekle: taksitler her ayın ilgili gününe ödenmemiş (○) olarak yazılır ve
        yaklaşınca hatırlatılır.
      </PageHeader>

      {loans.length > 0 && <LoanList loans={loans} onOpen={detail.show} />}
      <Calculator onAdd={sheet.show} />

      {sheet.item && (
        <AddLoanSheet plan={sheet.item} open={sheet.open} onClose={sheet.close} onExited={sheet.exited} />
      )}
      {detailLoan && (
        <LoanDetail
          loan={detailLoan}
          installments={installments.filter((i) => i.loan_id === detailLoan.id)}
          open={detail.open}
          onClose={detail.close}
          onExited={detail.exited}
        />
      )}
    </div>
  );
}

// ─── Kredilerim ─────────────────────────────────────────────────────────

function LoanList({ loans, onOpen }: { loans: LoanSummary[]; onOpen: (id: string) => void }) {
  const { currency } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <section className="rise mt-10" aria-label="Kredilerim">
      <h2 className="font-serif text-3xl tracking-tight">Kredilerim</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {loans.map((l) => {
          const progress = l.installments ? l.paid_count / l.installments : 0;
          const unpaid = l.installments - l.paid_count;
          return (
            <article key={l.id} className="card p-5">
              <button
                type="button"
                onClick={() => onOpen(l.id)}
                aria-label={`${l.name}: detay`}
                className="-m-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-surface-2"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
                  <Landmark size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {l.name}
                    {l.bank && <span className="font-normal text-ink-3"> · {l.bank}</span>}
                  </p>
                  <p className="text-xs text-ink-3">
                    {l.principal ? <Money minor={l.principal} currency={currency} /> : "Tutar belirtilmedi"} ·{" "}
                    {l.term_months} ay{l.monthly_rate !== null && ` · aylık %${num.format(l.monthly_rate)}`}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-0.5 self-center text-xs font-medium text-ink-2">
                  Detay <ChevronRight size={15} />
                </span>
              </button>

              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs text-ink-2">
                  <span>
                    <strong className="num text-ink">{l.paid_count}</strong>/{l.installments} taksit ödendi
                  </span>
                  <span className="num">{pctFmt.format(progress)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-income-fill transition-[width]" style={{ width: `${progress * 100}%` }} />
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="eyebrow">Kalan borç</dt>
                  <dd className="mt-1">
                    <Money minor={l.remaining_sum} currency={currency} className="font-medium" />
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Sıradaki taksit</dt>
                  <dd className="mt-1">
                    {l.next_due && l.next_amount !== null ? (
                      <>
                        <Money minor={l.next_amount} currency={currency} />{" "}
                        <span className="text-xs text-ink-3">· {dayMonthShort(l.next_due)}</span>
                      </>
                    ) : (
                      <span className="text-income">Bitti ✓</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                {l.next_due ? (
                  <Link
                    href={`/?ay=${monthOf(l.next_due)}`}
                    className="flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
                  >
                    Deftere git <ArrowRight size={14} />
                  </Link>
                ) : (
                  <span />
                )}
                <ConfirmButton
                  className="h-9 px-3 text-xs"
                  disabled={pending}
                  confirmText={unpaid ? `${unpaid} ödenmemiş taksit silinir` : "Silinsin mi?"}
                  onConfirm={() =>
                    startTransition(async () => {
                      const res = await deleteLoan(l.id);
                      toast(res.ok ? "Kredi silindi · ödenen taksitler defterde kaldı" : res.error, res.ok ? "default" : "error");
                    })
                  }
                >
                  Sil
                </ConfirmButton>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ─── Hesaplayıcı ────────────────────────────────────────────────────────

function Calculator({ onAdd }: { onAdd: (plan: Plan) => void }) {
  const { currency } = useApp();
  const [type, setType] = useState<LoanType>("ihtiyac");
  const [mode, setMode] = useState<"rate" | "installment">("rate");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("12");
  const [installment, setInstallment] = useState("");
  const [kkdf, setKkdf] = useState(String(LOAN_TYPES.ihtiyac.kkdf));
  const [bsmv, setBsmv] = useState(String(LOAN_TYPES.ihtiyac.bsmv));
  const [showAll, setShowAll] = useState(false);

  const chooseType = (t: LoanType) => {
    setType(t);
    setKkdf(String(LOAN_TYPES[t].kkdf));
    setBsmv(String(LOAN_TYPES[t].bsmv));
  };

  const p = toMinor(principal);
  const r = parseRate(rate);
  const n = parseMonths(months);
  const inst = toMinor(installment);
  const kk = parseRate(kkdf) ?? 0;
  const bs = parseRate(bsmv) ?? 0;

  const schedule = useMemo(() => {
    if (!n) return null;
    if (mode === "installment") return inst ? fixedSchedule(inst, n, p) : null;
    return p && r !== null ? annuitySchedule(p, r, kk, bs, n) : null;
  }, [mode, p, r, n, inst, kk, bs]);

  const rows = schedule ? (showAll ? schedule.rows : schedule.rows.slice(0, 12)) : [];
  const big = schedule ? moneyParts(schedule.installment, currency) : null;

  return (
    <section className="rise mt-10 [animation-delay:80ms]" aria-label="Kredi hesapla">
      <h2 className="font-serif text-3xl tracking-tight">Kredi hesapla</h2>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* Girdiler */}
        <div className="card space-y-5 p-5">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(LOAN_TYPES) as LoanType[]).map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={type === t} onClick={() => chooseType(t)}>
                {LOAN_TYPES[t].label}
              </button>
            ))}
          </div>

          <div role="radiogroup" className="grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm">
            {(
              [
                ["rate", "Faizden hesapla"],
                ["installment", "Taksiti biliyorum"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-9 rounded-full font-medium transition-all",
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-3",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Field label={mode === "rate" ? "Kredi tutarı" : "Kredi tutarı (isteğe bağlı)"}>
            <MoneyInput value={principal} onChange={setPrincipal} placeholder="100.000" />
          </Field>

          {mode === "rate" ? (
            <Field label="Aylık faiz oranı (%)" hint="Bankanın ilan ettiği aylık akdi faiz, ör. 3,49">
              <input
                className={cn("input num", rate && r === null && "border-expense")}
                inputMode="decimal"
                placeholder="3,49"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Aylık taksit">
              <MoneyInput value={installment} onChange={setInstallment} placeholder="4.500" />
            </Field>
          )}

          <Field label="Vade (ay)">
            <div className="flex gap-1.5">
              <input
                className={cn("input num w-24 shrink-0", months && !n && "border-expense")}
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))}
              />
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {[12, 24, 36, 48, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="chip h-12 shrink-0"
                    aria-pressed={n === m}
                    onClick={() => setMonths(String(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {mode === "rate" && (
            <details className="group rounded-2xl bg-surface-2/60 px-4 py-3 text-sm">
              <summary className="cursor-pointer list-none text-ink-2 marker:hidden">
                Vergiler: KKDF %{kkdf || 0} · BSMV %{bsmv || 0}{" "}
                <span className="text-xs text-ink-3 group-open:hidden">(değiştir)</span>
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="KKDF (%)">
                  <input className="input num" inputMode="decimal" value={kkdf} onChange={(e) => setKkdf(e.target.value)} />
                </Field>
                <Field label="BSMV (%)">
                  <input className="input num" inputMode="decimal" value={bsmv} onChange={(e) => setBsmv(e.target.value)} />
                </Field>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                Faize eklenen vergilerdir; ihtiyaç ve taşıt kredilerinde genelde %15 + %15, konutta yoktur. Oranlar
                mevzuatla değişebilir; bankanın ödeme planıyla karşılaştır.
              </p>
            </details>
          )}
        </div>

        {/* Sonuç */}
        <div className="min-w-0">
          {!schedule || !big ? (
            <div className="grid h-full min-h-48 place-items-center rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-3">
              {mode === "rate"
                ? "Tutar, aylık faiz ve vadeyi gir; taksit ve ödeme planı burada görünür."
                : "Taksit tutarını ve vadeyi gir."}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="eyebrow">Aylık taksit</p>
                <p className="mt-2 flex items-start font-serif text-[clamp(3rem,12vw,5.5rem)] leading-[0.85] tracking-[-0.03em]">
                  <span className="mr-[0.04em] mt-[0.08em] font-sans text-[0.3em] font-light text-ink-3">{big.symbol}</span>
                  <span className="italic">{big.int}</span>
                  <span className="num ml-[0.06em] mt-[0.1em] text-[0.26em] not-italic text-ink-3">,{big.frac}</span>
                </p>
                <p className="mt-2 text-xs text-ink-3">{n} ay boyunca</p>
              </div>

              <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                <Stat label="Toplam geri ödeme">
                  <Money minor={schedule.totalPayment} currency={currency} />
                </Stat>
                <Stat label={mode === "rate" ? "Toplam faiz" : "Toplam maliyet"}>
                  {mode === "installment" && !p ? (
                    <span className="text-ink-3">—</span>
                  ) : (
                    <Money minor={mode === "rate" ? schedule.totalInterest : schedule.totalCost} currency={currency} className="text-expense" />
                  )}
                </Stat>
                {mode === "rate" && (
                  <>
                    <Stat label="Vergiler">
                      <Money minor={schedule.totalTax} currency={currency} />
                    </Stat>
                    <Stat label="Yıllık maliyet">
                      <span className="num">{r !== null ? pctFmt.format(annualCostRate(r, kk, bs)) : "—"}</span>
                    </Stat>
                  </>
                )}
              </dl>

              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={() =>
                  onAdd({
                    type,
                    principal: p,
                    rate: mode === "rate" ? r : null,
                    kkdf: kk,
                    bsmv: bs,
                    months: n!,
                    installment: mode === "installment" ? inst : null,
                    schedule,
                  })
                }
              >
                <Plus size={18} /> Bu krediyi deftere ekle
              </button>

              {/* Ödeme planı */}
              <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="num w-full min-w-[28rem] text-right text-xs">
                    <thead className="bg-surface-2/70 text-[10px] uppercase tracking-[0.08em] text-ink-3">
                      <tr>
                        <th className="px-2 py-2.5 text-left font-medium">Ay</th>
                        <th className="px-2 py-2.5 font-medium">Taksit</th>
                        {mode === "rate" && (
                          <>
                            <th className="px-2 py-2.5 font-medium">Anapara</th>
                            <th className="px-2 py-2.5 font-medium">Faiz</th>
                            <th className="px-2 py-2.5 font-medium">Vergi</th>
                            <th className="px-2 py-2.5 font-medium">Kalan</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((row) => (
                        <tr key={row.no}>
                          <td className="px-2 py-2 text-left text-ink-3">{row.no}</td>
                          <td className="px-2 py-2 font-medium">{minorToInput2(row.payment)}</td>
                          {mode === "rate" && (
                            <>
                              <td className="px-2 py-2">{minorToInput2(row.principal)}</td>
                              <td className="px-2 py-2 text-ink-2">{minorToInput2(row.interest)}</td>
                              <td className="px-2 py-2 text-ink-2">{minorToInput2(row.tax)}</td>
                              <td className="px-2 py-2 text-ink-3">{minorToInput2(row.remaining)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {schedule.rows.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full border-t border-line py-2.5 text-xs text-ink-2 hover:text-ink"
                  >
                    {showAll ? "İlk 12 ayı göster" : `Tüm planı göster (${schedule.rows.length} ay)`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const two = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const minorToInput2 = (minor: number) => two.format(minor / 100);

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { currency } = useApp();
  return (
    <div className="relative">
      <input
        className={cn("input num pr-12", value && !toMinor(value) && "border-expense")}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 truncate text-[15px]">{children}</dd>
    </div>
  );
}

// ─── Deftere ekle ───────────────────────────────────────────────────────

function AddLoanSheet({
  plan,
  open,
  onClose,
  onExited,
}: {
  plan: Plan;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const { categories, currency, today } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(`${LOAN_TYPES[plan.type].label} kredisi`);
  const [firstDue, setFirstDue] = useState(dateInMonth(addMonths(monthOf(today), 1), dayOf(today)));
  const [categoryId, setCategoryId] = useState("");
  const [remind, setRemind] = useState<number | null>(DEFAULT_REMIND_DAYS);
  const [addIncome, setAddIncome] = useState(false);
  const [incomeOn, setIncomeOn] = useState(today);
  const [bank, setBank] = useState("");

  const dates = dueDates(firstDue, plan.months);
  const expenseCats = categories.filter((c) => c.kind === "expense" && c.name !== "Kredi");
  const kredi = categories.find((c) => c.kind === "expense" && c.name === "Kredi");

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await createLoan({
        name,
        principal: plan.principal,
        monthlyRate: plan.rate,
        kkdf: plan.kkdf,
        bsmv: plan.bsmv,
        termMonths: plan.months,
        firstDue,
        installment: plan.installment,
        categoryId: categoryId || null,
        remindDays: remind,
        incomeOn: addIncome ? incomeOn : null,
        bank,
        loanType: plan.type,
      }).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) return setError(res.error);
      toast(`${plan.months} taksit deftere eklendi`);
      onClose();
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title="Krediyi deftere ekle"
      footer={
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary mb-1 w-full">
          {pending && <Spinner />} {plan.months} taksiti deftere yaz
        </button>
      }
    >
      <div className="space-y-5 pb-5">
        <div className="card flex items-baseline justify-between p-4 text-sm">
          <span className="text-ink-2">
            {plan.months} × <Money minor={plan.schedule.installment} currency={currency} className="text-ink" />
          </span>
          <span className="text-right text-xs text-ink-3">
            {dayMonthShort(dates[0]!)} → <span className="capitalize">{monthLabel(monthOf(dates.at(-1)!))}</span>
          </span>
        </div>

        <Field label="Kredinin adı">
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div>
          <p className="eyebrow mb-2">Banka (isteğe bağlı)</p>
          <BankPicker value={bank} onChange={setBank} mine={[]} />
        </div>

        <Field label="İlk taksit tarihi" hint="Sonraki taksitler her ay aynı gün yazılır (o gün olmayan ayda ayın son günü).">
          <DateField value={firstDue} onChange={setFirstDue} ariaLabel="İlk taksit tarihi" />
        </Field>

        <Field label="Kategori">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{kredi ? `${kredi.emoji} Kredi` : "🏦 Kredi (otomatik oluşturulur)"}</option>
            {expenseCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </Field>

        <RemindPicker value={remind} onChange={setRemind} />

        <div className="space-y-3 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Çekilen tutarı gelir olarak ekle</p>
              <p className="text-xs text-ink-3">
                {plan.principal ? (
                  <Money minor={plan.principal} currency={currency} />
                ) : (
                  "Önce hesaplayıcıda kredi tutarını gir"
                )}
              </p>
            </div>
            <Switch
              checked={addIncome}
              disabled={!plan.principal}
              onChange={() => setAddIncome((v) => !v)}
              label="Çekilen tutarı gelir olarak ekle"
            />
          </div>
          {addIncome && <DateField value={incomeOn} onChange={setIncomeOn} ariaLabel="Kredinin çekildiği tarih" />}
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
