"use client";

import Link from "next/link";
import {
  ChevronRight,
  Download,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Share,
  ShieldCheck,
  SquarePlus,
  Sun,
} from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { changePassword, signOut, type AuthState } from "@/lib/actions/auth";
import { updateProfile } from "@/lib/actions/entries";
import { CURRENCIES } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { PageHeader } from "@/components/page-header";
import { useTheme, type ThemePref } from "@/components/theme";
import { useToast } from "@/components/toast";
import { cn, Notice, Spinner, SubmitButton } from "@/components/ui";
import { PushSettings } from "./push-settings";

export function Settings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const { username, currency, timezone, isAdmin } = useApp();
  const { pref, setPref } = useTheme();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [deviceTz, setDeviceTz] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cihaz saat dilimi yalnızca istemcide bilinir
    setDeviceTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const saveProfile = (patch: { currency?: string; timezone?: string }) =>
    startTransition(async () => {
      const res = await updateProfile({ currency, timezone, ...patch });
      toast(res.ok ? "Ayarlar kaydedildi" : res.error, res.ok ? "default" : "error");
    });

  return (
    <div className="mx-auto max-w-2xl px-5 lg:px-10">
      <PageHeader eyebrow="Tercihler" title="Ayarlar" />

      <div className="mt-10 space-y-10">
        {isAdmin && (
          <Link
            href="/yonetim"
            className="card rise flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-ink text-bg">
              <ShieldCheck size={18} />
            </span>
            <span className="flex-1">
              <span className="block font-medium">Yönetim paneli</span>
              <span className="block text-xs text-ink-3">Kullanıcılar, kayıt ayarı, şifre sıfırlama</span>
            </span>
            <ChevronRight size={16} className="text-ink-3" />
          </Link>
        )}

        <Group title="Bildirimler">
          <PushSettings publicKey={vapidPublicKey} />
          <p className="text-xs leading-relaxed text-ink-3">
            Hangi ödemenin kaç gün önce hatırlatılacağını her kayıtta seçebilirsin. Düzenli giderler için
            varsayılan 3 gündür.
          </p>
        </Group>

        <Group title="Görünüm">
          <Row label="Tema">
            <div className="flex rounded-full bg-surface-2 p-1">
              {(
                [
                  ["system", Monitor, "Sistem"],
                  ["light", Sun, "Açık"],
                  ["dark", Moon, "Koyu"],
                ] as [ThemePref, typeof Sun, string][]
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={pref === value}
                  onClick={() => setPref(value)}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                    pref === value ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-3",
                  )}
                >
                  <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </Row>
        </Group>

        <Group title="Bölge">
          <Row label="Para birimi" hint="Tutarların gösterimini değiştirir; kayıtlı değerler dönüştürülmez.">
            <select
              className="input h-10 w-auto pr-8"
              value={currency}
              disabled={pending}
              onChange={(e) => saveProfile({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Saat dilimi" hint={`“Bugün” ve düzenli kayıtlar buna göre hesaplanır. Şu an: ${timezone}`}>
            {deviceTz && deviceTz !== timezone ? (
              <button
                type="button"
                className="btn btn-ghost h-10 text-sm"
                disabled={pending}
                onClick={() => saveProfile({ timezone: deviceTz })}
              >
                {pending && <Spinner />} {deviceTz} kullan
              </button>
            ) : (
              <span className="text-sm text-ink-3">Cihazınla aynı ✓</span>
            )}
          </Row>
        </Group>

        <Group title="Verilerin">
          <Row label="Dışa aktar" hint="Tüm kayıtların, Excel ile uyumlu CSV dosyası olarak.">
            <a href="/api/disa-aktar" className="btn btn-ghost h-10 text-sm" download>
              <Download size={16} /> CSV indir
            </a>
          </Row>
          <p className="text-xs leading-relaxed text-ink-3">
            Kayıtların şifreli bağlantı üzerinden bulut veritabanında saklanır ve yalnızca senin hesabınla
            erişilebilir. Aynı hesapla giriş yaptığın her cihazda aynı defteri görürsün.
          </p>
        </Group>

        <Group title="Telefona yükle">
          <div className="grid gap-3 sm:grid-cols-2">
            <InstallCard
              title="iPhone / iPad"
              steps={[
                <>Safari’de bu sayfayı aç</>,
                <>
                  <Share size={14} className="inline" /> Paylaş’a dokun
                </>,
                <>
                  <SquarePlus size={14} className="inline" /> “Ana Ekrana Ekle”yi seç
                </>,
              ]}
            />
            <InstallCard
              title="Android"
              steps={[<>Chrome’da bu sayfayı aç</>, <>⋮ menüsüne dokun</>, <>“Uygulamayı yükle”yi seç</>]}
            />
          </div>
        </Group>

        <Group title="Hesap">
          <Row label="Kullanıcı adı">
            <span className="truncate text-sm text-ink-2">{username}</span>
          </Row>
          <ChangePassword />
          <form action={signOut}>
            <button type="submit" className="btn btn-danger w-full">
              <LogOut size={16} /> Çıkış yap
            </button>
          </form>
        </Group>
      </div>
    </div>
  );
}

function ChangePassword() {
  const [state, action] = useActionState<AuthState, FormData>(changePassword, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Row label="Şifre" hint="Değiştirince diğer cihazlardaki oturumlar kapanır.">
        <button type="button" className="btn btn-ghost h-10 text-sm" onClick={() => setOpen(true)}>
          <KeyRound size={16} /> Şifreyi değiştir
        </button>
      </Row>
    );
  }

  return (
    <form action={action} className="card space-y-3 p-4" noValidate>
      <input
        className="input"
        type="password"
        name="current"
        autoComplete="current-password"
        placeholder="Mevcut şifre"
        required
      />
      <input
        className="input"
        type="password"
        name="next"
        autoComplete="new-password"
        placeholder="Yeni şifre (en az 8 karakter)"
        minLength={8}
        required
      />
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.message && <Notice tone="info">{state.message}</Notice>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Vazgeç
        </button>
        <SubmitButton className="flex-1" pendingText="Kaydediliyor…">
          Kaydet
        </SubmitButton>
      </div>
    </form>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rise">
      <h2 className="eyebrow border-b border-line pb-3">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

function InstallCard({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <div className="card p-4">
      <p className="font-medium">{title}</p>
      <ol className="mt-3 space-y-2 text-sm text-ink-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px]">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
