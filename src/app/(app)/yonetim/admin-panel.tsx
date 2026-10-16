"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpDown,
  DoorClosed,
  DoorOpen,
  HeartPulse,
  NotebookPen,
  Search,
  ShieldCheck,
  Users,
  Bell,
  Check,
  ChevronRight,
  Headset,
  Copy,
  KeyRound,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import {
  deleteUser,
  resetUserPassword,
  setSignupOpen,
  setSupportAgent,
  setUserDisabled,
  setUserRole,
} from "@/lib/actions/admin";
import type { AdminOverview, AdminUser, DayCount } from "@/lib/admin";
import type { AppError } from "@/lib/errors";
import { AnnounceSection, ErrorsSection, type AnnouncementRow } from "./admin-extras";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Notice, Spinner } from "@/components/ui";

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const num = new Intl.NumberFormat("tr-TR");

/** "az önce", "3 saat önce", "5 gün önce", sonra tarih. */
function ago(ms: number | null): string {
  if (ms === null) return "hiç";
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 2) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} gün önce`;
  return dateFmt.format(ms);
}

export function AdminPanel({
  overview,
  meId,
  errors = [],
  announcements = [],
}: {
  overview: AdminOverview;
  meId: string;
  errors?: AppError[];
  announcements?: AnnouncementRow[];
}) {
  const toast = useToast();
  const sheet = useSheetState<AdminUser>();
  const [, startTransition] = useTransition();
  const [signupOpen, setOptimisticSignup] = useOptimistic(overview.signupOpen);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSort>("seen");

  const toggleSignup = () =>
    startTransition(async () => {
      const next = !signupOpen;
      setOptimisticSignup(next);
      const res = await setSignupOpen(next);
      toast(
        res.ok ? (next ? "Yeni kayıtlar açıldı" : "Yeni kayıtlar kapatıldı") : res.error,
        res.ok ? "default" : "error",
      );
    });

  const users = overview.users;
  const counts: Record<UserFilter, number> = {
    all: users.length,
    active: users.filter((u) => presence(u.lastSeenMs) !== "away").length,
    admin: users.filter((u) => u.role === "admin").length,
    mod: users.filter((u) => u.supportAgent && u.role !== "admin").length,
    disabled: users.filter((u) => u.disabled).length,
  };
  const q = query.trim().toLocaleLowerCase("tr");
  const shown = users
    .filter((u) => !q || u.username.includes(q))
    .filter((u) =>
      filter === "all"
        ? true
        : filter === "active"
          ? presence(u.lastSeenMs) !== "away"
          : filter === "admin"
            ? u.role === "admin"
            : filter === "mod"
              ? u.supportAgent && u.role !== "admin"
              : u.disabled,
    )
    .sort((a, b) =>
      sort === "seen"
        ? (b.lastSeenMs ?? 0) - (a.lastSeenMs ?? 0)
        : sort === "entries"
          ? b.entries - a.entries
          : b.createdMs - a.createdMs,
    );
  const maxEntries = Math.max(1, ...users.map((u) => u.entries));

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 lg:px-10">
      {/* Başlık: kontrol odası */}
      <header className="rise flex flex-wrap items-end justify-between gap-4 pt-4 lg:pt-12">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <ShieldCheck size={13} /> Yönetim
          </p>
          <h1 className="mt-2 font-serif text-5xl tracking-tight lg:text-6xl">Kontrol odası</h1>
          <p className="mt-2 max-w-lg text-sm text-ink-2">
            Hesaplar, sistemin sağlığı ve uygulamanın nabzı. Gizlilik gereği tutarlar ve açıklamalar burada görünmez;
            yalnızca sayılar.
          </p>
        </div>
      </header>

      {/* Sistem durumu şeridi */}
      <div className="rise no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <StatusPill ok label="Veritabanı" detail={`${overview.dbMs} ms`} />
        <StatusPill
          ok={overview.pushConfigured}
          label="Bildirim servisi"
          detail={overview.pushConfigured ? "hazır" : "anahtar yok"}
        />
        <StatusPill
          ok={overview.cronHealthy}
          label="Sabah görevi"
          detail={overview.cronLastRunMs ? ago(overview.cronLastRunMs) : "hiç çalışmadı"}
        />
        <button
          type="button"
          onClick={toggleSignup}
          aria-pressed={signupOpen}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors",
            signupOpen
              ? "border-income/30 bg-income-fill/15 text-income"
              : "border-line bg-surface-2 text-ink-2 hover:text-ink",
          )}
        >
          {signupOpen ? <DoorOpen size={14} /> : <DoorClosed size={14} />}
          Yeni kayıtlar {signupOpen ? "açık" : "kapalı"}
          <span className="font-normal opacity-70">· değiştir</span>
        </button>
      </div>

      {/* Özet kutuları */}
      <section className="rise mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 [animation-delay:40ms]" aria-label="Özet">
        <Kpi
          icon={<Users size={16} />}
          label="Kullanıcı"
          value={users.length}
          delta={overview.newUsersThisWeek ? `+${num.format(overview.newUsersThisWeek)} bu hafta` : "bu hafta yeni yok"}
        />
        <Kpi
          icon={<Activity size={16} />}
          label="Aktif (7 gün)"
          value={overview.activeLast7Days}
          delta={`bugün ${num.format(overview.activeToday)} · %${users.length ? Math.round((overview.activeLast7Days / users.length) * 100) : 0}`}
        />
        <Kpi
          icon={<NotebookPen size={16} />}
          label="Toplam kayıt"
          value={overview.totalEntries}
          delta={`+${num.format(overview.entriesThisWeek)} bu hafta`}
        />
        <Link href="/destek/gelen" className="block">
          <Kpi
            icon={<Headset size={16} />}
            label="Destek bekleyen"
            value={overview.supportWaiting}
            delta={overview.supportWaiting ? "yanıtla →" : "kutu boş"}
            alert={overview.supportWaiting > 0}
          />
        </Link>
      </section>

      {/* Uygulamanın nabzı: son 30 gün, günlük eklenen kayıt (barkod) */}
      <Pulse daily={overview.daily} />
      <div className="grid gap-x-4 lg:grid-cols-2 lg:items-start">
        <AnnounceSection history={announcements} />
        <ErrorsSection errors={errors} />
      </div>

      {/* Kullanıcılar */}
      <section className="rise mt-10 [animation-delay:120ms]" aria-label="Kullanıcılar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-3xl tracking-tight">Kullanıcılar</h2>
          <div className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kullanıcı ara…"
              aria-label="Kullanıcı ara"
              className="input h-10 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="no-scrollbar -mx-5 mt-3 flex items-center gap-1.5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="chip shrink-0"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="num opacity-60">{counts[f.key]}</span>
            </button>
          ))}
          <label className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
            <ArrowUpDown size={13} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as UserSort)}
              aria-label="Sırala"
              className="bg-transparent py-1 text-xs font-medium text-ink-2 outline-none"
            >
              <option value="seen">Son görülme</option>
              <option value="entries">Kayıt sayısı</option>
              <option value="joined">Katılma</option>
            </select>
          </label>
        </div>

        {shown.length === 0 ? (
          <p className="mt-6 rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-2">
            Bu filtreye uyan kullanıcı yok.
          </p>
        ) : (
          <ul className="card mt-4 divide-y divide-line overflow-hidden">
            {shown.map((u) => {
              const pr = presence(u.lastSeenMs);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => sheet.show(u)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="relative shrink-0">
                      <Avatar name={u.username} dim={u.disabled} />
                      <span
                        title={PRESENCE[pr].label}
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-surface",
                          PRESENCE[pr].dot,
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("truncate font-medium", u.disabled && "text-ink-3 line-through")}>
                          {u.username}
                        </span>
                        {u.id === meId && <Badge>sen</Badge>}
                        {u.role === "admin" && <Badge tone="ink">yönetici</Badge>}
                        {u.supportAgent && u.role !== "admin" && <Badge tone="sky">moderatör</Badge>}
                        {u.disabled && <Badge tone="expense">devre dışı</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-3">
                        {pr === "now" ? "şimdi aktif" : `son görülme ${ago(u.lastSeenMs)}`} · katıldı{" "}
                        {dateFmt.format(u.createdMs)}
                        {u.devices > 0 && (
                          <>
                            {" · "}
                            <Bell size={10} className="inline" /> {u.devices}
                          </>
                        )}
                      </span>
                    </span>
                    {/* Kayıt sayısı ve bu haftaki katkı */}
                    <span className="hidden w-32 shrink-0 sm:block">
                      <span className="flex items-baseline justify-between text-xs">
                        <span className="num font-semibold">{num.format(u.entries)}</span>
                        {u.entriesWeek > 0 && <span className="num text-income">+{num.format(u.entriesWeek)}</span>}
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-ink/70"
                          style={{ width: `${Math.max(3, (u.entries / maxEntries) * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="num shrink-0 text-xs font-semibold sm:hidden">{num.format(u.entries)}</span>
                    <ChevronRight size={16} className="shrink-0 text-ink-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {sheet.item && (
        <UserSheet
          user={sheet.item}
          isMe={sheet.item.id === meId}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
        />
      )}
    </div>
  );
}

type UserFilter = "all" | "active" | "admin" | "mod" | "disabled";
type UserSort = "seen" | "entries" | "joined";
const FILTERS: { key: UserFilter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "active", label: "Aktif" },
  { key: "admin", label: "Yönetici" },
  { key: "mod", label: "Moderatör" },
  { key: "disabled", label: "Devre dışı" },
];

/** Son görülmeye göre durum: şimdi (1 saat), bugün, bu hafta, uzun süredir yok. */
type Presence = "now" | "today" | "week" | "away";
function presence(ms: number | null): Presence {
  if (ms === null) return "away";
  const h = (Date.now() - ms) / 3_600_000;
  return h < 1.5 ? "now" : h < 24 ? "today" : h < 24 * 7 ? "week" : "away";
}
const PRESENCE: Record<Presence, { label: string; dot: string }> = {
  now: { label: "Şimdi aktif", dot: "bg-income-fill" },
  today: { label: "Bugün görüldü", dot: "bg-sky-500" },
  week: { label: "Bu hafta görüldü", dot: "bg-amber-400" },
  away: { label: "Bir haftadan uzun süredir yok", dot: "bg-ink-3/50" },
};

function StatusPill({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs">
      <span className="relative flex size-2">
        {ok && <span className="absolute inset-0 animate-ping rounded-full bg-income-fill opacity-60" />}
        <span className={cn("relative size-2 rounded-full", ok ? "bg-income-fill" : "bg-amber-500")} />
      </span>
      <span className="font-semibold">{label}</span>
      <span className="text-ink-3">{detail}</span>
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  delta,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  delta: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "h-full rounded-3xl border p-4 transition-colors",
        alert ? "border-expense/30 bg-expense/[0.06] hover:bg-expense/[0.1]" : "border-line bg-surface",
      )}
    >
      <p className={cn("flex items-center gap-2 text-xs font-medium", alert ? "text-expense" : "text-ink-3")}>
        {icon} {label}
      </p>
      <p className={cn("num mt-2 text-3xl font-semibold leading-none tracking-tight", alert && "text-expense")}>
        {num.format(value)}
      </p>
      <p className="mt-2 truncate text-[11px] text-ink-3">{delta}</p>
    </div>
  );
}

const pulseDay = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Son 30 günde günlük eklenen kayıt sayısı: uygulamanın barkodu. Yeni üye olan günlerde üstte nokta. */
function Pulse({ daily }: { daily: DayCount[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.entries));
  const total = daily.reduce((s, d) => s + d.entries, 0);
  const signups = daily.reduce((s, d) => s + d.signups, 0);
  const active = hover !== null ? daily[hover] : null;
  return (
    <section className="card rise mt-4 p-4 sm:p-5 [animation-delay:80ms]" aria-label="Uygulamanın nabzı">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <HeartPulse size={16} className="text-expense" /> Uygulamanın nabzı
          <span className="font-normal text-ink-3">· son 30 gün</span>
        </p>
        <p className="num text-xs text-ink-3">
          {active ? (
            <>
              <span className="font-semibold text-ink">{pulseDay.format(Date.parse(`${active.day}T00:00:00Z`))}</span> ·{" "}
              {num.format(active.entries)} kayıt{active.signups > 0 && ` · ${active.signups} yeni üye`}
            </>
          ) : (
            <>
              {num.format(total)} kayıt · {num.format(signups)} yeni üye
            </>
          )}
        </p>
      </div>
      <div className="mt-4 flex h-28 items-end gap-[3px]" onPointerLeave={() => setHover(null)}>
        {daily.map((d, i) => (
          <span
            key={d.day}
            onPointerEnter={() => setHover(i)}
            className="relative flex h-full flex-1 items-end"
            aria-label={`${d.day}: ${d.entries} kayıt`}
          >
            <span
              className={cn(
                "block w-full rounded-[2px] transition-opacity",
                i === daily.length - 1 ? "bg-income-fill" : "bg-ink",
                hover !== null && hover !== i ? "opacity-30" : "opacity-85",
              )}
              style={{ height: `${Math.max(2, (d.entries / max) * 100)}%` }}
            />
            {d.signups > 0 && (
              <span className="absolute -top-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-sky-500" />
            )}
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-ink-3">
        <span>{daily[0] && pulseDay.format(Date.parse(`${daily[0].day}T00:00:00Z`))}</span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-sky-500" /> yeni üye
        </span>
        <span>bugün</span>
      </div>
    </section>
  );
}

function UserSheet({
  user,
  isMe,
  open,
  onClose,
  onExited,
}: {
  user: AdminUser;
  isMe: boolean;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, close = true) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error, "error");
      toast(success);
      if (close) onClose();
    });

  const reset = () =>
    startTransition(async () => {
      const res = await resetUserPassword(user.id);
      if (!res.ok) return toast(res.error, "error");
      setTempPassword(res.password);
    });

  const copy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
    } catch {
      toast("Kopyalanamadı; şifreyi elle seç.", "error");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} onExited={onExited} title={user.username}>
      <div className="space-y-6 pb-6">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Katıldı" value={dateFmt.format(user.createdMs)} />
          <Info label="Son görülme" value={ago(user.lastSeenMs)} />
          <Info label="Kayıt sayısı" value={num.format(user.entries)} />
          <Info label="Bildirimli cihaz" value={num.format(user.devices)} />
        </dl>

        {isMe ? (
          <Notice tone="info">
            Bu senin hesabın. Kendini kilitlememen için kendi hesabında yönetim işlemleri kapalı; şifreni
            Ayarlar&apos;dan değiştirebilirsin.
          </Notice>
        ) : (
          <>
            {tempPassword ? (
              <div className="card space-y-3 p-4">
                <p className="text-sm font-medium">Geçici şifre</p>
                <div className="flex items-center gap-2">
                  <code className="num flex-1 select-all rounded-xl bg-surface-2 px-4 py-3 text-lg tracking-wider">
                    {tempPassword}
                  </code>
                  <button type="button" onClick={copy} className="btn btn-ghost h-12 px-4" aria-label="Kopyala">
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-ink-3">
                  Bu şifre bir daha gösterilmeyecek. {user.username} kullanıcısına ilet; giriş yaptıktan sonra Ayarlar →
                  Şifreyi değiştir ile kendi şifresini belirlemeli. Açık oturumları kapatıldı.
                </p>
              </div>
            ) : (
              <ActionRow
                icon={<KeyRound size={18} />}
                title="Şifreyi sıfırla"
                hint="Geçici bir şifre üretilir ve tüm cihazlardaki oturumları kapatılır."
              >
                <button type="button" onClick={reset} disabled={pending} className="btn btn-ghost h-10 text-sm">
                  {pending && <Spinner />} Sıfırla
                </button>
              </ActionRow>
            )}

            <ActionRow
              icon={user.role === "admin" ? <ShieldOff size={18} /> : <Shield size={18} />}
              title={user.role === "admin" ? "Yöneticiliği kaldır" : "Yönetici yap"}
              hint={
                user.role === "admin"
                  ? "Yönetim paneline erişimi kalmaz."
                  : "Bu panele erişir ve diğer hesapları yönetebilir."
              }
            >
              <button
                type="button"
                disabled={pending}
                className="btn btn-ghost h-10 text-sm"
                onClick={() =>
                  act(
                    () => setUserRole(user.id, user.role === "admin" ? "user" : "admin"),
                    user.role === "admin" ? "Yöneticilik kaldırıldı" : "Yönetici yapıldı",
                  )
                }
              >
                {user.role === "admin" ? "Kaldır" : "Yap"}
              </button>
            </ActionRow>

            <ActionRow
              icon={<Headset size={18} />}
              title={user.supportAgent ? "Destek moderatörlüğünü kaldır" : "Destek moderatörü yap"}
              hint={
                user.role === "admin"
                  ? "Yöneticiler destek kutusunu zaten görür; bu ayar yöneticilik kaldırılırsa geçerli olur."
                  : user.supportAgent
                    ? "Destek kutusunu artık göremez."
                    : "Canlı destek mesajlarını görür ve yanıtlar. Yönetim paneline erişemez."
              }
            >
              <button
                type="button"
                disabled={pending}
                className="btn btn-ghost h-10 text-sm"
                onClick={() =>
                  act(
                    () => setSupportAgent(user.id, !user.supportAgent),
                    user.supportAgent ? "Moderatörlük kaldırıldı" : "Destek moderatörü yapıldı",
                  )
                }
              >
                {user.supportAgent ? "Kaldır" : "Yap"}
              </button>
            </ActionRow>

            <ActionRow
              icon={user.disabled ? <UserCheck size={18} /> : <UserX size={18} />}
              title={user.disabled ? "Hesabı etkinleştir" : "Devre dışı bırak"}
              hint={
                user.disabled
                  ? "Kullanıcı yeniden giriş yapabilir; verileri olduğu gibi duruyor."
                  : "Giriş yapamaz, açık oturumları kapanır. Verileri silinmez."
              }
            >
              <button
                type="button"
                disabled={pending}
                className="btn btn-ghost h-10 text-sm"
                onClick={() =>
                  act(
                    () => setUserDisabled(user.id, !user.disabled),
                    user.disabled ? "Hesap etkinleştirildi" : "Hesap devre dışı bırakıldı",
                  )
                }
              >
                {user.disabled ? "Etkinleştir" : "Devre dışı"}
              </button>
            </ActionRow>

            <div className="border-t border-line pt-5">
              <p className="font-medium text-expense">Hesabı sil</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">
                {user.username} hesabı ve {num.format(user.entries)} kaydı, kategorileri, düzenli kayıtları kalıcı
                olarak silinir. Bu işlem geri alınamaz.
              </p>
              <ConfirmButton
                className="mt-3 w-full"
                disabled={pending}
                confirmText="Kalıcı olarak silinsin mi? Tekrar dokun"
                onConfirm={() => act(() => deleteUser(user.id), "Hesap silindi")}
              >
                Hesabı sil
              </ConfirmButton>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Avatar({ name, dim }: { name: string; dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 font-serif text-xl uppercase italic",
        dim && "opacity-40",
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "ink" | "expense" | "sky" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "ink"
          ? "bg-ink text-bg"
          : tone === "expense"
            ? "bg-expense/15 text-expense"
            : tone === "sky"
              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
              : "bg-surface-2 text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/60 px-3 py-3">
      <dt className="text-[11px] font-medium text-ink-3">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-ink-3">{hint}</p>
      </div>
      {children}
    </div>
  );
}
