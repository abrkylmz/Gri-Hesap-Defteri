"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  deleteIpo,
  deleteIpoAccount,
  deleteIpoSale,
  saveIpo,
  saveIpoAccount,
  saveIpoSale,
  setIpoPrice,
} from "@/lib/actions/ipo";
import type { ActionResult } from "@/lib/action-utils";
import { normalizeCode, plClass, saleProfit, type Ipo, type IpoAccount, type IpoAllocation, type IpoSale } from "@/lib/ipo";
import { formatMoney, minorToInput, toMinor } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { ConfirmButton, Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Field, Money, showPicker, Spinner } from "@/components/ui";

type SheetProps = { open: boolean; onClose: () => void; onExited: () => void };

const num = new Intl.NumberFormat("tr-TR");
const two = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const price2 = (minor: number) => two.format(minor / 100);
const parseLots = (s: string) => {
  const t = s.replace(/[.\s]/g, "");
  if (!t) return 0;
  return /^\d+$/.test(t) ? Number(t) : NaN;
};

/** Ortak kaydet/sil akışı: bekleme durumu, hata metni, bildirim, kapanış. */
function useAction(onClose: () => void) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, success: string, close = true) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      toast(success);
      if (close) onClose();
    });
  return { pending, error, setError, run };
}

function PriceInput({
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { currency } = useApp();
  return (
    <div className="relative">
      <input
        className="input num pr-12"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
    </div>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-expense">
      {error}
    </p>
  ) : null;
}

// ─── Hesaplar ───────────────────────────────────────────────────────────

export function AccountsSheet({
  accounts,
  allocations,
  ...sheet
}: SheetProps & { accounts: IpoAccount[]; allocations: IpoAllocation[] }) {
  const { pending, error, run } = useAction(() => {});
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((a) => [a.id, a.name])),
  );
  const [newName, setNewName] = useState("");

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    run(() => saveIpoAccount({ name }), "Hesap eklendi", false);
    setNewName("");
  };
  const rename = (a: IpoAccount) => {
    const name = (names[a.id] ?? "").trim();
    if (name && name !== a.name) run(() => saveIpoAccount({ id: a.id, name }), "Hesap adı güncellendi", false);
  };

  return (
    <Sheet {...sheet} title="Hesaplar">
      <div className="space-y-5 pb-6">
        <p className="text-sm text-ink-2">
          Halka arzlara katıldığın aracı kurum / kişi hesapları. Adına dokunup değiştirebilirsin.
        </p>
        <ul className="space-y-2">
          {accounts.map((a) => {
            const used = allocations.filter((x) => x.account_id === a.id).length;
            return (
              <li key={a.id} className="flex items-center gap-2">
                <input
                  className="input"
                  value={names[a.id] ?? a.name}
                  maxLength={40}
                  onChange={(e) => setNames((n) => ({ ...n, [a.id]: e.target.value }))}
                  onBlur={() => rename(a)}
                  onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                  aria-label="Hesap adı"
                />
                <ConfirmButton
                  className="h-12 shrink-0 px-4 text-xs"
                  disabled={pending}
                  confirmText={used ? `${used} katılım da silinir` : "Sil?"}
                  onConfirm={() => run(() => deleteIpoAccount(a.id), "Hesap silindi", false)}
                >
                  <Trash2 size={16} />
                </ConfirmButton>
              </li>
            );
          })}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            className="input"
            placeholder={accounts.length === 0 ? "ör. Ahmet · Garanti" : "Yeni hesap adı"}
            value={newName}
            maxLength={40}
            autoFocus={accounts.length === 0}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary h-12 shrink-0" disabled={pending || !newName.trim()}>
            {pending ? <Spinner /> : <Plus size={18} />} Ekle
          </button>
        </form>
        <ErrorText error={error} />
      </div>
    </Sheet>
  );
}

// ─── Halka arz ekle / düzenle ───────────────────────────────────────────

export function IpoEditor({
  ipo,
  accounts,
  allocations,
  sales,
  onManageAccounts,
  ...sheet
}: SheetProps & {
  ipo?: Ipo;
  accounts: IpoAccount[];
  allocations: IpoAllocation[];
  sales: IpoSale[];
  onManageAccounts: () => void;
}) {
  const { currency, today } = useApp();
  const { pending, error, setError, run } = useAction(sheet.onClose);
  const existing = ipo ? allocations.filter((a) => a.ipo_id === ipo.id) : [];

  const [code, setCode] = useState(ipo?.code ?? "");
  const [name, setName] = useState(ipo?.name ?? "");
  const [price, setPrice] = useState(ipo ? minorToInput(ipo.offer_price) : "");
  const [listedOn, setListedOn] = useState(ipo?.listed_on ?? today);
  const [lots, setLots] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      accounts.map((a) => [a.id, String(existing.find((x) => x.account_id === a.id)?.lots ?? "")]),
    ),
  );

  const offer = toMinor(price);
  const soldFor = (accountId: string) => {
    const alloc = existing.find((x) => x.account_id === accountId);
    return alloc ? sales.filter((s) => s.allocation_id === alloc.id).reduce((n, s) => n + s.lots, 0) : 0;
  };
  const parsed = accounts.map((a) => ({ accountId: a.id, lots: parseLots(lots[a.id] ?? "") }));
  const totalLots = parsed.reduce((n, p) => n + (Number.isNaN(p.lots) ? 0 : p.lots), 0);

  const save = () => {
    const normalized = normalizeCode(code);
    if (normalized.length < 2) return setError("Hisse kodunu gir (ör. ALTNY).");
    if (!offer) return setError("Arz fiyatını gir (ör. 32,00).");
    if (parsed.some((p) => Number.isNaN(p.lots))) return setError("Lot sayıları tam sayı olmalı.");
    run(
      () =>
        saveIpo({
          id: ipo?.id,
          code: normalized,
          name,
          offerPrice: offer,
          listedOn: listedOn || null,
          allocations: parsed.map((p) => ({ accountId: p.accountId, lots: p.lots })),
        }),
      ipo ? "Halka arz güncellendi" : "Halka arz eklendi",
    );
  };

  return (
    <Sheet
      {...sheet}
      title={ipo ? `${ipo.code} düzenle` : "Yeni halka arz"}
      footer={
        <div className="flex gap-2 pb-1">
          {ipo && (
            <ConfirmButton
              disabled={pending}
              confirmText="Tüm satışlarıyla silinsin mi?"
              onConfirm={() => run(() => deleteIpo(ipo.id), "Halka arz silindi")}
            >
              Sil
            </ConfirmButton>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <form
        className="space-y-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Field label="Kod">
            <input
              className="input num uppercase tracking-wider"
              placeholder="ALTNY"
              value={code}
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={!ipo}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
            />
          </Field>
          <Field label="Şirket (isteğe bağlı)">
            <input
              className="input"
              placeholder="ör. Altınay Savunma"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arz fiyatı (lot başı)">
            <PriceInput value={price} onChange={setPrice} />
          </Field>
          <Field label="İşlem tarihi">
            <input type="date" className="input" onClick={showPicker} value={listedOn} onChange={(e) => setListedOn(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Hangi hesaba kaç lot geldi?</p>
            <button type="button" onClick={onManageAccounts} className="text-xs text-ink-3 hover:text-ink">
              Hesapları düzenle
            </button>
          </div>
          <ul className="space-y-2">
            {accounts.map((a) => {
              const n = parseLots(lots[a.id] ?? "");
              const sold = soldFor(a.id);
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="num block text-xs text-ink-3">
                      {offer && n > 0 ? `= ${formatMoney(n * offer, currency)}` : "katılım yok"}
                      {sold > 0 && ` · ${num.format(sold)} lot satıldı`}
                    </span>
                  </span>
                  <div className="relative w-32 shrink-0">
                    <input
                      className={cn("input num pr-10 text-right", Number.isNaN(n) && "border-expense")}
                      inputMode="numeric"
                      placeholder="0"
                      value={lots[a.id] ?? ""}
                      onChange={(e) => setLots((l) => ({ ...l, [a.id]: e.target.value }))}
                      aria-label={`${a.name} lot`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">lot</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {offer && totalLots > 0 ? (
            <p className="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-sm">
              <span className="text-ink-2">
                Toplam <span className="num text-xs text-ink-3">· {num.format(totalLots)} lot</span>
              </span>
              <Money minor={totalLots * offer} currency={currency} className="font-medium" />
            </p>
          ) : null}
        </div>

        <ErrorText error={error} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

// ─── Satış ──────────────────────────────────────────────────────────────

export type SaleTarget = {
  ipo: Ipo;
  account: IpoAccount;
  allocation: IpoAllocation;
  /** Satılabilir lot (düzenlenen satışın kendi lotu dahil) */
  remaining: number;
  sale?: IpoSale;
};

export function SaleEditor({ target, ...sheet }: SheetProps & { target: SaleTarget }) {
  const { currency, today } = useApp();
  const { ipo, account, allocation, remaining, sale } = target;
  const { pending, error, setError, run } = useAction(sheet.onClose);

  const [lots, setLots] = useState(String(sale?.lots ?? remaining));
  const [price, setPrice] = useState(sale ? minorToInput(sale.price) : "");
  const [commission, setCommission] = useState(sale?.commission ? minorToInput(sale.commission) : "");
  const [soldOn, setSoldOn] = useState(sale?.sold_on ?? today);

  const n = parseLots(lots);
  const p = toMinor(price);
  const c = commission.trim() ? toMinor(commission) : 0;
  const net = p && n > 0 && c !== null ? n * p - c : null;
  // Satıştan kâr/zarar = (satış fiyatı − arz fiyatı) × lot − komisyon
  const pl = p && n > 0 && c !== null ? saleProfit({ lots: n, price: p, commission: c }, ipo.offer_price) : null;
  // Kullanıcı toplam tutarı fiyat alanına yazmış olabilir: arz fiyatının 5 katından fazlası şüpheli.
  const suspicious = p !== null && p > ipo.offer_price * 5;

  const save = () => {
    if (!(n > 0)) return setError("Satılan lot sayısını gir.");
    if (n > remaining) return setError(`En fazla ${num.format(remaining)} lot satabilirsin.`);
    if (!p) return setError("Satış fiyatını gir.");
    if (c === null) return setError("Komisyon tutarı geçersiz.");
    run(
      () =>
        saveIpoSale({ id: sale?.id, allocationId: allocation.id, lots: n, price: p, commission: c, soldOn }),
      sale ? "Satış güncellendi" : "Satış kaydedildi",
    );
  };

  return (
    <Sheet
      {...sheet}
      title={`${ipo.code} satışı`}
      footer={
        <div className="flex gap-2 pb-1">
          {sale && (
            <ConfirmButton
              disabled={pending}
              confirmText="Sil"
              onConfirm={() => run(() => deleteIpoSale(sale.id), "Satış silindi")}
            >
              Sil
            </ConfirmButton>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} {sale ? "Güncelle" : "Satışı kaydet"}
          </button>
        </div>
      }
    >
      <form
        className="space-y-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">{account.name}</span> · {num.format(allocation.lots)} lot geldi ·
          arz <Money minor={ipo.offer_price} currency={currency} />
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Lot (en fazla ${num.format(remaining)})`}>
            <div className="flex gap-1.5">
              <input
                className={cn("input num", Number.isNaN(n) && "border-expense")}
                inputMode="numeric"
                value={lots}
                autoFocus
                onChange={(e) => setLots(e.target.value)}
              />
              <button
                type="button"
                className="chip h-12 shrink-0"
                aria-pressed={n === remaining}
                onClick={() => setLots(String(remaining))}
              >
                Tümü
              </button>
            </div>
          </Field>
          <Field label="Satış fiyatı (1 lot)">
            <PriceInput
              value={price}
              onChange={setPrice}
              placeholder={ipo.current_price ? minorToInput(ipo.current_price) : "0,00"}
            />
          </Field>
          <Field label="Komisyon (isteğe bağlı)">
            <PriceInput value={commission} onChange={setCommission} placeholder="0" />
          </Field>
          <Field label="Tarih">
            <input type="date" className="input" onClick={showPicker} value={soldOn} onChange={(e) => setSoldOn(e.target.value)} />
          </Field>
        </div>

        {suspicious && (
          <p className="rounded-2xl bg-expense/10 px-4 py-3 text-xs leading-relaxed text-expense">
            Bu fiyat arz fiyatının 5 katından fazla. Toplam satış tutarını mı yazdın? Buraya{" "}
            <strong>1 lotun</strong> satış fiyatını yazmalısın.
          </p>
        )}

        {net !== null && pl !== null && p && (
          <div className="card space-y-2 p-4 text-sm">
            <p className="num flex items-baseline justify-between text-ink-2">
              <span>
                ({price2(p)} − {price2(ipo.offer_price)}) × {num.format(n)} lot
                {c ? ` − ${price2(c)} kom.` : ""}
              </span>
            </p>
            <p className="flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-ink-2">
                Ele geçen <Money minor={net} currency={currency} className="text-ink" />
              </span>
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-[0.1em] text-ink-3">Kâr/zarar</span>
                <Money minor={pl} currency={currency} sign className={cn("text-lg font-medium", plClass(pl))} />
              </span>
            </p>
          </div>
        )}

        <ErrorText error={error} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

// ─── Güncel fiyat ───────────────────────────────────────────────────────

export function PriceEditor({ ipo, ...sheet }: SheetProps & { ipo: Ipo }) {
  const { pending, error, setError, run } = useAction(sheet.onClose);
  const [price, setPrice] = useState(ipo.current_price ? minorToInput(ipo.current_price) : "");

  const save = () => {
    const p = toMinor(price);
    if (!p) return setError("Geçerli bir fiyat gir.");
    run(() => setIpoPrice(ipo.id, p), "Güncel fiyat kaydedildi");
  };

  return (
    <Sheet
      {...sheet}
      title={`${ipo.code} güncel fiyat`}
      footer={
        <div className="flex gap-2 pb-1">
          {ipo.current_price !== null && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => run(() => setIpoPrice(ipo.id, null), "Güncel fiyat temizlendi")}
            >
              Temizle
            </button>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <form
        className="space-y-4 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="text-sm text-ink-2">
          Eldeki lotların değeri ve açık pozisyon kâr/zararı bu fiyatla hesaplanır. Fiyat girilmezse arz fiyatı
          kullanılır.
        </p>
        <PriceInput value={price} onChange={setPrice} autoFocus />
        <ErrorText error={error} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
