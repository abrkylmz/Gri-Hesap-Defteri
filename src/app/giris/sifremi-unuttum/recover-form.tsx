"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useActionState, useState } from "react";
import { recoverAccount, type AuthState } from "@/lib/actions/auth";
import { cn, Field, Notice, PasswordInput, SubmitButton } from "@/components/ui";

/** Kullanıcı adı + kurtarma kodu ile yeni şifre. */
export function RecoverForm() {
  const [state, action] = useActionState<AuthState, FormData>(recoverAccount, null);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <div className="rise">
      <Link href="/giris" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Girişe dön
      </Link>
      <h2 className="font-serif text-4xl tracking-tight">Şifremi unuttum</h2>
      <p className="mt-2 text-sm text-ink-2">
        Ayarlar → Hesap bölümünden oluşturduğun <strong>kurtarma kodu</strong> ile yeni şifre belirle. Kodun yoksa
        uygulamanın yöneticisinden şifre sıfırlamasını iste.
      </p>

      <form action={action} className="mt-8 space-y-4">
        <Field label="Kullanıcı adı">
          <input
            name="username"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state?.username}
            required
          />
        </Field>
        <Field label="Kurtarma kodu" hint="ör. ABCD-EFGH-JKMN-PQRS (tire ve büyük/küçük harf fark etmez)">
          <input
            name="code"
            className="input num uppercase tracking-wider"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
        </Field>
        <Field label="Yeni şifre">
          <PasswordInput
            name="next"
            autoComplete="new-password"
            minLength={8}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="En az 8 karakter"
          />
        </Field>
        <Field label="Yeni şifre (tekrar)">
          <PasswordInput
            name="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            className={cn(mismatch && "!border-expense")}
          />
        </Field>
        {mismatch && <p className="-mt-2 text-xs text-expense">Şifreler eşleşmiyor.</p>}
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <SubmitButton pendingText="Kontrol ediliyor…">Yeni şifreyi kaydet</SubmitButton>
      </form>
    </div>
  );
}
