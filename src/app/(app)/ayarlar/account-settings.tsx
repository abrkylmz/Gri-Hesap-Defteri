"use client";

import {
  Check,
  Copy,
  DatabaseBackup,
  KeyRound,
  Laptop,
  LifeBuoy,
  LogOut,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { deleteOwnAccount, revokeOtherSessions, revokeSession } from "@/lib/actions/account";
import { createRecoveryCode } from "@/lib/actions/auth";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Notice, PasswordInput, Spinner } from "@/components/ui";

export type SessionInfo = {
  id: string;
  userAgent: string | null;
  createdMs: number;
  lastUsedMs: number | null;
  current: boolean;
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const ago = (ms: number | null) => {
  if (!ms) return "—";
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 60) return "son bir saat içinde";
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d} gün önce` : dateFmt.format(ms);
};

/** Tarayıcı bilgisinden okunabilir cihaz adı: "iPhone · Safari", "Windows · Chrome"… */
export function deviceName(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: "Bilinmeyen cihaz", mobile: false };
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Cihaz";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /FxiOS|Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Tarayıcı";
  return { label: `${os} · ${browser}`, mobile: /iPhone|Android|iPad|Mobile/.test(ua) };
}

function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 max-w-sm">
        <p className="font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Şifre kurtarma kodu: oluştur / yenile (şifre onaylı). Kod yalnızca bir kez gösterilir. */
export function RecoveryRow({ createdMs, justRecovered }: { createdMs: number | null; justRecovered: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {justRecovered && (
        <Notice tone="info">
          Şifren kurtarma koduyla yenilendi ve eski kod artık geçersiz. Yeni bir kurtarma kodu oluşturmayı unutma.
        </Notice>
      )}
      <Row
        label="Kurtarma kodu"
        hint={
          createdMs ? (
            <>Oluşturuldu: {dateFmt.format(createdMs)}. Şifreni unutursan bu kodla yeni şifre belirlersin.</>
          ) : (
            <span className="text-expense">
              Yok. Şifreni unutursan hesabına ancak yönetici yardımıyla girebilirsin; bir kod oluştur.
            </span>
          )
        }
      >
        <button type="button" className="btn btn-ghost h-10 text-sm" onClick={() => setOpen(true)}>
          <LifeBuoy size={16} /> {createdMs ? "Yenile" : "Oluştur"}
        </button>
      </Row>
      {open && <RecoverySheet onDone={() => setOpen(false)} />}
    </div>
  );
}

function RecoverySheet({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const res = await createRecoveryCode(password).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı.",
      }));
      if (!res.ok) return setError(res.error);
      setCode(res.code);
      setPassword("");
    });
  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast("Kopyalanamadı; kodu elle seç.", "error");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onExited={onDone}
      title="Kurtarma kodu"
      footer={
        <div className="pb-1">
          {code ? (
            <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(false)}>
              Kaydettim, kapat
            </button>
          ) : (
            <button type="button" className="btn btn-primary w-full" disabled={pending || !password} onClick={create}>
              {pending ? <Spinner /> : <KeyRound size={16} />} Kodu oluştur
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 pb-5">
        {code ? (
          <>
            <p className="text-sm text-ink-2">
              Bu kodu güvenli bir yere yaz ya da ekran görüntüsü al. <strong>Bir daha gösterilmeyecek.</strong> Kodu
              kullandığında geçersiz olur; yenisini buradan oluşturursun.
            </p>
            <div className="flex items-center gap-2">
              <code className="num flex-1 select-all rounded-2xl bg-surface-2 px-4 py-4 text-center text-xl font-semibold tracking-wider">
                {code}
              </code>
              <button type="button" onClick={copy} className="btn btn-ghost h-14 px-4" aria-label="Kopyala">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              Şifreni unutursan giriş ekranındaki <strong>Şifremi unuttum</strong> bağlantısından kullanıcı adın ve bu
              kodla yeni şifre belirlersin. Yeni kod oluşturmak eskisini geçersiz kılar.
            </p>
            <PasswordInput
              autoComplete="current-password"
              placeholder="Mevcut şifren"
              value={password}
              onChange={(e) => {
                setError(null);
                setPassword(e.target.value);
              }}
            />
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Sheet>
  );
}

/** Açık oturumlar: hangi cihazlarda giriş yapılı; tek tek ya da topluca kapatma. */
export function SessionsList({ sessions }: { sessions: SessionInfo[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const others = sessions.filter((s) => !s.current).length;
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) =>
    start(async () => {
      const res = await fn().catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı." }));
      toast(res.ok ? msg : res.error, res.ok ? "default" : "error");
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Açık oturumlar</p>
          <p className="mt-0.5 text-xs text-ink-3">Telefonun kaybolursa diğer cihazlardaki oturumları buradan kapat.</p>
        </div>
        {others > 0 && (
          <button
            type="button"
            disabled={pending}
            className="btn btn-ghost h-10 text-sm"
            onClick={() => run(revokeOtherSessions, "Diğer cihazlardan çıkış yapıldı")}
          >
            {pending ? <Spinner /> : <LogOut size={16} />} Diğerlerinden çık
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {sessions.map((s) => {
          const d = deviceName(s.userAgent);
          const Icon = d.mobile ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/50 px-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-ink-2">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{d.label}</span>
                  {s.current && (
                    <span className="shrink-0 rounded-full bg-income-fill/20 px-2 py-0.5 text-[10px] font-semibold text-income">
                      bu cihaz
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-ink-3">
                  Son kullanım {ago(s.lastUsedMs ?? s.createdMs)} · giriş {dateFmt.format(s.createdMs)}
                </span>
              </span>
              {!s.current && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => revokeSession(s.id), "Oturum kapatıldı")}
                  aria-label={`${d.label} oturumunu kapat`}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-expense/10 hover:text-expense"
                >
                  <LogOut size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type RestoreReport = { table: string; added: number; skipped: number; failed?: string }[];
const TABLE_LABELS: Record<string, string> = {
  categories: "Kategoriler",
  transactions: "Kayıtlar",
  recurring: "Düzenli kayıtlar",
  templates: "Şablonlar",
  template_items: "Şablon kalemleri",
  loans: "Krediler",
  holdings: "Döviz & altın",
  wallets: "Nakit hesaplar",
  credit_limits: "Limitler",
  crypto_holdings: "Kripto",
  goals: "Hedefler",
  ipo_accounts: "Halka arz hesapları",
  ipos: "Halka arzlar",
  ipo_allocations: "Katılımlar",
  ipo_sales: "Satışlar",
};

/** Tam yedek: indir ve geri yükle (mevcut verilere eklenir; aynı yedek iki kez yüklenirse çoğalmaz). */
export function BackupRows() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [report, setReport] = useState<{ rows: RestoreReport; from: string } | null>(null);

  const upload = (file: File) =>
    start(async () => {
      try {
        const res = await fetch("/api/yedek", { method: "POST", body: await file.text() });
        const data = (await res.json()) as { error?: string; report?: RestoreReport; from?: string };
        if (!res.ok || !data.report) return void toast(data.error ?? "Yedek yüklenemedi.", "error");
        setReport({ rows: data.report, from: data.from ?? "" });
        toast("Yedek yüklendi");
      } catch {
        toast("Yedek yüklenemedi. Dosyayı ve bağlantını kontrol et.", "error");
      } finally {
        if (input.current) input.current.value = "";
      }
    });

  const added = report?.rows.reduce((s, r) => s + r.added, 0) ?? 0;
  return (
    <div className="space-y-3">
      <Row
        label="Tam yedek"
        hint="Kayıtlar, kategoriler, düzenli kayıtlar, krediler, varlıklar, limitler, hedefler ve halka arz; tek dosya."
      >
        <a href="/api/yedek" download className="btn btn-ghost h-10 text-sm">
          <DatabaseBackup size={16} /> İndir
        </a>
      </Row>
      <Row label="Yedekten geri yükle" hint="Dosyadaki veriler mevcut verilerine eklenir; zaten olanlar atlanır.">
        <button
          type="button"
          disabled={pending}
          className="btn btn-ghost h-10 text-sm"
          onClick={() => input.current?.click()}
        >
          {pending ? <Spinner /> : <Upload size={16} />} Dosya seç
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </Row>
      {report && (
        <div className="rounded-2xl bg-surface-2/60 p-3 text-xs">
          <p className="font-semibold">
            {added > 0 ? `${added} öğe eklendi` : "Yeni bir şey eklenmedi (hepsi zaten vardı)"}
            {report.from && <span className="font-normal text-ink-3"> · {report.from} yedeği</span>}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {report.rows.map((r) => (
              <li key={r.table} className={cn("flex justify-between gap-2", r.failed && "text-expense")}>
                <span className="truncate">{TABLE_LABELS[r.table] ?? r.table}</span>
                <span className="num shrink-0">{r.failed ? "hata" : `+${r.added}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Tehlikeli bölge: hesabı ve tüm verileri kalıcı olarak sil. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-expense/30 bg-expense/[0.04] p-4">
      <p className="font-medium text-expense">Hesabı sil</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">
        Hesabın ve tüm verilerin (kayıtlar, varlıklar, hedefler, destek mesajları…) kalıcı olarak silinir. Geri
        alınamaz. Önce yukarıdan tam yedek indirmeni öneririz.
      </p>
      <button type="button" className="btn btn-danger mt-3 h-10 text-sm" onClick={() => setOpen(true)}>
        <Trash2 size={16} /> Hesabımı sil
      </button>
      {open && <DeleteSheet onDone={() => setOpen(false)} />}
    </div>
  );
}

function DeleteSheet({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = password.length > 0 && confirm.trim().toLocaleUpperCase("tr") === "SİL";

  const remove = () =>
    start(async () => {
      const res = await deleteOwnAccount(password, confirm).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı.",
      }));
      if (res && !res.ok) setError(res.error);
    });

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onExited={onDone}
      title="Hesabı sil"
      footer={
        <div className="pb-1">
          <button type="button" className="btn btn-danger w-full" disabled={!ready || pending} onClick={remove}>
            {pending ? <Spinner /> : <Trash2 size={16} />} Kalıcı olarak sil
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-5">
        <Notice tone="error">
          Bu işlem geri alınamaz. Tüm kayıtların, varlıkların, hedeflerin ve paylaşımların silinir; paylaştığın
          defterlere erişim de kalkar.
        </Notice>
        <PasswordInput
          autoComplete="current-password"
          placeholder="Şifren"
          value={password}
          onChange={(e) => {
            setError(null);
            setPassword(e.target.value);
          }}
        />
        <label className="block">
          <span className="text-xs text-ink-3">
            Onaylamak için kutuya <strong className="text-ink">SİL</strong> yaz
          </span>
          <input
            className="input mt-1.5"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            placeholder="SİL"
          />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Sheet>
  );
}
