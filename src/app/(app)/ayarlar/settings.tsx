"use client";

import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Database,
  Download,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Palette,
  PanelBottom,
  Share,
  ShieldCheck,
  Smartphone,
  SquarePlus,
  Sun,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { changePassword, signOut, type AuthState } from "@/lib/actions/auth";
import { updateProfile } from "@/lib/actions/entries";
import { haptic, hapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import { CURRENCIES } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { clearOfflinePages } from "@/components/offline-sync";
import { PageHeader } from "@/components/page-header";
import { HomeLayoutEditor } from "@/components/home-layout-editor";
import { NavTabsEditor } from "@/components/nav-tabs-editor";
import { NAV_ICONS } from "@/components/nav-icons";
import { NAV_TABS, navTab, REQUIRED_TAB, type NavTabKey } from "@/lib/nav-tabs";
import { HOME_VIEWS, HOME_WIDGETS, type HomeLayout } from "@/lib/home-layout";
import { STYLES, useTheme, type StylePref, type ThemePref } from "@/components/theme";
import { ThemePreview } from "@/components/theme-preview";
import { useToast } from "@/components/toast";
import { cn, Notice, PasswordInput, Spinner, SubmitButton } from "@/components/ui";
import { PushSettings } from "./push-settings";
import { SharingSettings, type SharingData } from "./sharing-settings";

export function Settings({
  vapidPublicKey,
  ownProfile,
  sharing,
  homeLayout,
  navTabs,
}: {
  vapidPublicKey: string | null;
  ownProfile: { currency: string; timezone: string };
  sharing: SharingData;
  homeLayout: HomeLayout;
  navTabs: NavTabKey[];
}) {
  const { username, isAdmin } = useApp();
  const { currency, timezone } = ownProfile;
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

  // Telefonda alt çubukta olmayan sayfalar kısayol olarak gösterilir.
  const shortcuts = NAV_TABS.filter((t) => t.key !== REQUIRED_TAB && !navTabs.includes(t.key));

  return (
    <div className="mx-auto max-w-2xl px-5 lg:px-10">
      <PageHeader eyebrow="Tercihler" title="Ayarlar" />

      {/* Profil */}
      <section className="card rise mt-6 flex items-center gap-4 p-4">
        <span className="keep-serif grid size-14 shrink-0 place-items-center rounded-full bg-ink font-serif text-2xl text-bg">
          {username.slice(0, 1).toLocaleUpperCase("tr-TR")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">{username}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
            {isAdmin ? (
              <span className="rounded-full bg-ink px-2 py-0.5 font-semibold text-bg">Yönetici</span>
            ) : (
              <span>Kişisel hesap</span>
            )}
            <span>
              {currency} · {timezone.split("/").at(-1)?.replace("_", " ")}
            </span>
          </span>
        </span>
        <form action={signOut} onSubmit={clearOfflinePages} className="shrink-0">
          <button
            type="submit"
            className="flex h-10 items-center gap-1.5 rounded-full border border-expense/30 px-3.5 text-sm font-semibold text-expense transition-colors hover:bg-expense/10"
          >
            <LogOut size={16} /> Çıkış yap
          </button>
        </form>
      </section>

      <SectionChips />

      {/* Telefonda kısayollar: alt çubukta olmayan sayfalar */}
      {(shortcuts.length > 0 || isAdmin) && (
        <section className="rise mt-4 lg:hidden" aria-label="Kısayollar">
          <div className="grid grid-cols-3 gap-2">
            {isAdmin && <Shortcut href="/yonetim" label="Yönetim" icon={ShieldCheck} strong />}
            {shortcuts.map((t) => (
              <Shortcut key={t.key} href={t.href} label={t.label} icon={NAV_ICONS[t.key]} />
            ))}
          </div>
        </section>
      )}
      {isAdmin && (
        <Link
          href="/yonetim"
          className="card rise mt-4 hidden items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2 lg:flex"
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

      <div className="mt-8 space-y-8 pb-6">
        <Group id="gorunum" title="Görünüm" icon={Palette} tone="bg-violet-500/12 text-violet-600 dark:text-violet-300">
          <ThemeModePicker />
          <StylePicker />
          <HapticsRow />
        </Group>

        <Group id="menu" title="Ana ekran ve menü" icon={LayoutDashboard} tone="bg-sky-500/12 text-sky-700 dark:text-sky-300">
          <HomeLayoutRow layout={homeLayout} />
          <NavTabsRow tabs={navTabs} />
        </Group>

        <Group id="bildirimler" title="Bildirimler" icon={Bell} tone="bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <PushSettings publicKey={vapidPublicKey} />
          <p className="text-xs leading-relaxed text-ink-3">
            Hangi ödemenin kaç gün önce hatırlatılacağını her kayıtta seçebilirsin. Düzenli giderler için
            varsayılan 3 gündür.
          </p>
        </Group>

        <Group id="bolge" title="Bölge" icon={Globe} tone="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
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

        <Group id="veriler" title="Verilerin" icon={Database} tone="bg-teal-500/12 text-teal-700 dark:text-teal-300">
          <LinkRow href="/api/disa-aktar" download icon={Download} label="Dışa aktar" hint="Tüm kayıtlar, Excel ile uyumlu CSV." />
          <LinkRow
            href="/ice-aktar"
            icon={Upload}
            label="Ekstre içe aktar"
            hint="Banka hesap/kart hareketlerini (CSV, Excel) deftere ekle."
          />
          <LinkRow
            href="/rapor"
            icon={FileText}
            label="Aylık rapor"
            hint="Ayın özeti, kategoriler ve hareketler; PDF olarak kaydedilir."
          />
          <p className="text-xs leading-relaxed text-ink-3">
            Kayıtların şifreli bağlantı üzerinden bulut veritabanında saklanır ve yalnızca senin hesabınla
            erişilebilir. Aynı hesapla giriş yaptığın her cihazda aynı defteri görürsün.
          </p>
        </Group>

        <Group id="paylasim" title="Paylaşım" icon={Users} tone="bg-pink-500/12 text-pink-700 dark:text-pink-300">
          <SharingSettings sharing={sharing} />
        </Group>

        <Group id="yukle" title="Telefona yükle" icon={Smartphone} tone="bg-slate-500/12 text-slate-700 dark:text-slate-300">
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

        <Group id="hesap" title="Hesap" icon={UserRound} tone="bg-ink/10 text-ink">
          <Row label="Kullanıcı adı">
            <span className="truncate text-sm text-ink-2">{username}</span>
          </Row>
          <ChangePassword />
        </Group>
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: "gorunum", label: "Görünüm" },
  { id: "menu", label: "Menü" },
  { id: "bildirimler", label: "Bildirimler" },
  { id: "bolge", label: "Bölge" },
  { id: "veriler", label: "Veriler" },
  { id: "paylasim", label: "Paylaşım" },
  { id: "yukle", label: "Yükle" },
  { id: "hesap", label: "Hesap" },
] as const;

/** Bölümlere atlayan, kaydırırken üstte kalan kategori çipleri; ekrandaki bölüm vurgulanır. */
function SectionChips() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((x) => document.getElementById(x.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return (
    <nav
      aria-label="Ayar bölümleri"
      className="no-scrollbar sticky top-[env(safe-area-inset-top)] z-20 -mx-5 mt-4 flex gap-1.5 overflow-x-auto bg-bg/85 px-5 py-2 backdrop-blur-xl lg:-mx-10 lg:px-10"
    >
      {SECTIONS.map((x) => (
        <a
          key={x.id}
          href={`#${x.id}`}
          onClick={(e) => {
            e.preventDefault();
            setActive(x.id);
            document.getElementById(x.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          aria-current={active === x.id ? "true" : undefined}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
            active === x.id ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink",
          )}
        >
          {x.label}
        </a>
      ))}
    </nav>
  );
}

function Shortcut({ href, label, icon: Icon, strong }: { href: string; label: string; icon: LucideIcon; strong?: boolean }) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center gap-2 px-2 py-3.5 text-center text-xs font-medium transition-colors hover:bg-surface-2"
    >
      <span className={cn("grid size-10 place-items-center rounded-xl", strong ? "bg-ink text-bg" : "bg-surface-2 text-ink")}>
        <Icon size={19} />
      </span>
      <span className="w-full truncate">{label}</span>
    </Link>
  );
}

function LinkRow({
  href,
  icon: Icon,
  label,
  hint,
  download,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  download?: boolean;
}) {
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-3" />
    </>
  );
  const cls = "flex items-center gap-3 transition-colors hover:bg-surface-2";
  return download ? (
    <a href={href} download className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

/** Mobil alt çubukta hangi sekmeler (2–5) ve hangi sırayla. */
function NavTabsRow({ tabs }: { tabs: NavTabKey[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Row label="Alt menü" hint={`Telefondaki alt çubuk: ${tabs.map((k) => navTab(k).label).join(", ")}. En fazla 5 sekme.`}>
      <button type="button" className="btn btn-ghost h-10 text-sm" onClick={() => setOpen(true)}>
        <PanelBottom size={16} /> Düzenle
      </button>
      {open && <NavTabsEditor initial={tabs} onDone={() => setOpen(false)} />}
    </Row>
  );
}

export function ChangePassword() {
  const [state, action] = useActionState<AuthState, FormData>(changePassword, null);
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // Tekrar alanı dolmaya başlayınca (ya da kaydet'e basılınca) eşleşme gösterilir.
  const mismatch = next !== confirm && (submitted || confirm.length > 0);
  const matches = confirm.length > 0 && next === confirm;

  // Şifre değişince alanları boşalt.
  useEffect(() => {
    if (!state?.message) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucu yanıtına göre formu sıfırla
    setNext("");
    setConfirm("");
    setSubmitted(false);
  }, [state]);

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
    <form
      action={action}
      onSubmit={(e) => {
        setSubmitted(true);
        if (next !== confirm) e.preventDefault(); // eşleşmiyorsa sunucuya gönderme
      }}
      className="space-y-3"
      noValidate
    >
      <PasswordInput name="current" autoComplete="current-password" placeholder="Mevcut şifre" required />
      <PasswordInput
        name="next"
        autoComplete="new-password"
        placeholder="Yeni şifre (en az 8 karakter)"
        minLength={8}
        required
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <PasswordInput
        name="confirm"
        autoComplete="new-password"
        placeholder="Yeni şifre (tekrar)"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        aria-invalid={mismatch}
        aria-describedby="confirm-status"
        className={cn(mismatch && "!border-expense", matches && "!border-income")}
      />
      <p id="confirm-status" aria-live="polite" className="-mt-1 min-h-4 text-xs">
        {mismatch ? (
          <span className="text-expense">Şifreler eşleşmiyor.</span>
        ) : matches ? (
          <span className="text-income">Şifreler eşleşiyor.</span>
        ) : null}
      </p>
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

const STYLE_INFO: Record<StylePref, { name: string; desc: string }> = {
  classic: {
    name: "Klasik",
    desc: "Kâğıt ve grafit; gri, sakin, el yazısı rakamlar.",
  },
  modern: {
    name: "Modern",
    desc: "Temiz beyaz kartlar, yumuşak gölgeler.",
  },
  glass: {
    name: "Cam efekti",
    desc: "Renkli degrade zemin, buzlu cam yüzeyler.",
  },
  minimal: {
    name: "Minimal",
    desc: "Sade ve düz; gölgesiz, ince çizgiler.",
  },
};

/** Açık / koyu / sistem: seçili stille çizilmiş önizlemeli kutucuklar. */
export function ThemeModePicker() {
  const { pref, setPref, style } = useTheme();
  const modes: [ThemePref, typeof Sun, string][] = [
    ["system", Monitor, "Sistem"],
    ["light", Sun, "Açık"],
    ["dark", Moon, "Koyu"],
  ];
  return (
    <div>
      <p className="font-medium">Tema</p>
      <p className="mt-0.5 text-xs text-ink-3">Üst çubuktaki ay/güneş simgesiyle her ekrandan da değiştirebilirsin.</p>
      <div role="radiogroup" aria-label="Tema" className="mt-3 grid grid-cols-3 gap-2">
        {modes.map(([value, Icon, label]) => {
          const on = pref === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPref(value)}
              className={cn(
                "overflow-hidden rounded-2xl border text-left transition-all",
                on ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink-3",
              )}
            >
              <span className="relative flex h-28 overflow-hidden border-b border-line">
                {value === "system" ? (
                  <>
                    <span className="w-1/2 overflow-hidden">
                      <span className="block h-full w-[200%]">
                        <ThemePreview style={style} mode="light" />
                      </span>
                    </span>
                    <span className="relative w-1/2 overflow-hidden">
                      <span className="absolute inset-y-0 right-0 block h-full w-[200%]">
                        <ThemePreview style={style} mode="dark" />
                      </span>
                    </span>
                  </>
                ) : (
                  <ThemePreview style={style} mode={value} />
                )}
              </span>
              <span className="flex items-center gap-1.5 bg-surface px-2.5 py-2 text-sm font-medium">
                <Icon size={14} className="text-ink-3" /> {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Görünüm stili seçici. Açık/koyu tercihiyle birleşir (ör. Modern + Koyu). Cihaza özeldir. */
export function StylePicker() {
  const { style, setStyle } = useTheme();
  return (
    <div>
      <p className="font-medium">Stil</p>
      <p className="mt-0.5 text-xs text-ink-3">Renkler ve yüzeyler; yukarıdaki açık/koyu seçimiyle birlikte uygulanır.</p>
      <div role="radiogroup" aria-label="Stil" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STYLES.map((s) => {
          const info = STYLE_INFO[s];
          const on = style === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStyle(s)}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border text-left transition-all",
                on ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink-3",
              )}
            >
              {/* Mini ekran: bu stil + şu anki açık/koyu (CSS ile seçilir) */}
              <span className="relative block h-28 overflow-hidden border-b border-line">
                <ThemePreview style={s} mode="light" className="dark:hidden" />
                <ThemePreview style={s} mode="dark" className="hidden dark:flex" />
              </span>
              <span className="block bg-surface p-2.5">
                <span className="block text-sm font-semibold">{info.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">{info.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ana ekranın bölümlerini gizle/göster ve sırala. */
function HomeLayoutRow({ layout }: { layout: HomeLayout }) {
  const [open, setOpen] = useState(false);
  const shown = HOME_WIDGETS.length - layout.hidden.length;
  return (
    <Row
      label="Dashboard görünümü"
      hint={`${HOME_VIEWS.find((v) => v.key === layout.view)!.label} · ${shown}/${HOME_WIDGETS.length} bölüm görünür. Görünümü seç, bölümleri gizle ya da sırala.`}
    >
      <button type="button" className="btn btn-ghost h-10 text-sm" onClick={() => setOpen(true)}>
        <LayoutDashboard size={16} /> Düzenle
      </button>
      {open && <HomeLayoutEditor initial={layout} onDone={() => setOpen(false)} />}
    </Row>
  );
}

/** Dokunsal geri bildirim: Android'de titreşim, iPhone'da (iOS 18+) sistem dokunuşu. Cihaza özeldir. */
function HapticsRow() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnızca istemcide okunabilir
    setOn(hapticsEnabled());
  }, []);
  const toggle = () => {
    const next = !on;
    setHapticsEnabled(next);
    setOn(next);
    if (next) haptic("success");
  };
  return (
    <Row label="Titreşim" hint="Kayıt eklerken, ✓ işaretlerken ve kaydırırken hafif titreşim. Bu cihaz için geçerli.">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Titreşim"
        onClick={toggle}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-colors",
          on ? "bg-ink" : "bg-surface-2 ring-1 ring-line ring-inset",
        )}
      >
        <span
          className={cn(
            "absolute left-1 top-1 size-6 rounded-full shadow-sm transition-transform",
            on ? "translate-x-6 bg-surface" : "bg-ink-3",
          )}
        />
      </button>
    </Row>
  );
}

function Group({
  id,
  title,
  icon: Icon,
  tone,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rise scroll-mt-16">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold">
        <span className={cn("grid size-7 place-items-center rounded-lg", tone)}>
          <Icon size={15} />
        </span>
        {title}
      </h2>
      <div className="card mt-3 divide-y divide-line overflow-hidden [&>*]:px-4 [&>*]:py-3.5">{children}</div>
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
