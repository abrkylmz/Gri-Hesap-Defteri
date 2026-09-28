"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { Field, Notice, SubmitButton } from "@/components/ui";

export default function NewPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, null);

  return (
    <AuthShell>
      <div className="rise">
        <h2 className="font-serif text-4xl tracking-tight">Yeni şifre belirle.</h2>
        <p className="mt-2 text-sm text-ink-2">Bundan sonra bu şifreyle giriş yapacaksın.</p>
        <form action={action} className="mt-8 space-y-4" noValidate>
          <Field label="Yeni şifre" hint="En az 8 karakter.">
            <input
              className="input"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="••••••••"
            />
          </Field>
          {state?.error && <Notice tone="error">{state.error}</Notice>}
          <SubmitButton pendingText="Kaydediliyor…">Şifreyi kaydet</SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
