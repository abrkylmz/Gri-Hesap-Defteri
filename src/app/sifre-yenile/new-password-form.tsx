"use client";

import { useActionState } from "react";
import { resetPassword, type AuthState } from "@/lib/actions/auth";
import { Field, Notice, SubmitButton } from "@/components/ui";

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthState, FormData>(resetPassword, null);

  return (
    <form action={action} className="mt-8 space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
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
  );
}
