"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { Field, Notice, SubmitButton } from "@/components/ui";

export default function ResetRequestPage() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, null);

  return (
    <AuthShell>
      <div className="rise">
        <h2 className="font-serif text-4xl tracking-tight">Şifreni mi unuttun?</h2>
        <p className="mt-2 text-sm text-ink-2">
          E-posta adresini yaz; yeni şifre belirlemen için bir bağlantı gönderelim.
        </p>
        <form action={action} className="mt-8 space-y-4" noValidate>
          <Field label="E-posta">
            <input
              className="input"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={state?.email ?? ""}
              placeholder="ornek@eposta.com"
            />
          </Field>
          {state?.error && <Notice tone="error">{state.error}</Notice>}
          {state?.message && <Notice tone="info">{state.message}</Notice>}
          <SubmitButton pendingText="Gönderiliyor…">Bağlantı gönder</SubmitButton>
        </form>
        <Link
          href="/giris"
          className="mt-6 inline-block text-sm text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
        >
          ← Girişe dön
        </Link>
      </div>
    </AuthShell>
  );
}
