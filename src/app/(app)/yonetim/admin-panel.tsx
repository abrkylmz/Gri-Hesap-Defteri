"use client";

import { Bell, Check, ChevronRight, Copy, KeyRound, Shield, ShieldOff, UserCheck, UserX } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import {
  deleteUser,
  resetUserPassword,
  setSignupOpen,
  setUserDisabled,
  setUserRole,
} from "@/lib/actions/admin";
import type { AdminOverview, AdminUser } from "@/lib/admin";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Notice, Spinner, Switch } from "@/components/ui";

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

export function AdminPanel({ overview, meId }: { overview: AdminOverview; meId: string }) {
  const toast = useToast();
  const sheet = useSheetState<AdminUser>();
  const [, startTransition] = useTransition();
  const [signupOpen, setOptimisticSignup] = useOptimistic(overview.signupOpen);

  const toggleSignup = () =>
    startTransition(async () => {
      const next = !signupOpen;
      setOptimisticSignup(next);
      const res = await setSignupOpen(next);
      toast(res.ok ? (next ? "Yeni kayıtlar açıldı" : "Yeni kayıtlar kapatıldı") : res.error, res.ok ? "default" : "error");
    });

  return (
    <div className="mx-auto max-w-3xl px-5 lg:px-10">
      <PageHeader eyebrow="Yönetim" title="Kullanıcılar">
        Hesapları buradan yönetirsin. Gizlilik gereği kullanıcıların tutarları ve açıklamaları burada
        görünmez; yalnızca kaç kayıt girdikleri görünür.
      </PageHeader>

      <div className="card rise mt-8 grid grid-cols-3 divide-x divide-line p-0">
        <Stat label="Kullanıcı" value={num.format(overview.users.length)} />
        <Stat label="Son 7 gün aktif" value={num.format(overview.activeLast7Days)} />
        <Stat label="Toplam kayıt" value={num.format(overview.totalEntries)} />
      </div>

      <div className="card rise mt-4 flex items-center justify-between gap-4 px-5 py-4 [animation-delay:60ms]">
        <div>
          <p className="font-medium">Yeni kayıtlar</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {signupOpen
              ? "Açık: giriş ekranında herkes hesap oluşturabilir."
              : "Kapalı: yalnızca mevcut hesaplar giriş yapabilir."}
          </p>
        </div>
        <Switch checked={signupOpen} onChange={toggleSignup} label="Yeni kayıtlara izin ver" />
      </div>

      <ul className="rise mt-8 [animation-delay:120ms]">
        {overview.users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => sheet.show(u)}
              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl border-b border-line px-2 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <Avatar name={u.username} dim={u.disabled} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("truncate font-medium", u.disabled && "text-ink-3 line-through")}>
                    {u.username}
                  </span>
                  {u.id === meId && <Badge>sen</Badge>}
                  {u.role === "admin" && <Badge tone="ink">yönetici</Badge>}
                  {u.disabled && <Badge tone="expense">devre dışı</Badge>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">
                  Son görülme {ago(u.lastSeenMs)} · {num.format(u.entries)} kayıt
                  {u.devices > 0 && (
                    <>
                      {" · "}
                      <Bell size={10} className="inline" /> {u.devices}
                    </>
                  )}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-3" />
            </button>
          </li>
        ))}
      </ul>

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
                  Bu şifre bir daha gösterilmeyecek. {user.username} kullanıcısına ilet; giriş yaptıktan sonra
                  Ayarlar → Şifreyi değiştir ile kendi şifresini belirlemeli. Açık oturumları kapatıldı.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between px-4 py-4">
      <p className="eyebrow leading-snug">{label}</p>
      <p className="num mt-1.5 text-2xl">{value}</p>
    </div>
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

function Badge({ children, tone }: { children: React.ReactNode; tone?: "ink" | "expense" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "ink" ? "bg-ink text-bg" : tone === "expense" ? "bg-expense/15 text-expense" : "bg-surface-2 text-ink-2",
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
