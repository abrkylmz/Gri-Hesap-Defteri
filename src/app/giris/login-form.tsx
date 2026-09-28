"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { Field, Notice, SubmitButton, cn } from "@/components/ui";

type Mode = "signin" | "signup";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction] = useActionState<AuthState, FormData>(signIn, null);
  const [signUpState, signUpAction] = useActionState<AuthState, FormData>(signUp, null);
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cihaz saat dilimi yalnızca istemcide bilinir
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const state = mode === "signin" ? signInState : signUpState;
  const isSignIn = mode === "signin";

  return (
    <div className="rise">
      <h2 className="font-serif text-4xl tracking-tight">
        {isSignIn ? "Tekrar hoş geldin." : "Defterini aç."}
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        {isSignIn
          ? "Verilerin bulutta; hangi cihazdan girersen gir, defterin seninle."
          : "Birkaç saniye sürer. Varsayılan kategoriler seni bekliyor olacak."}
      </p>

      <div role="tablist" className="mt-8 grid grid-cols-2 rounded-full bg-surface-2 p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "h-10 rounded-full text-sm font-medium transition-all",
              mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-3",
            )}
          >
            {m === "signin" ? "Giriş yap" : "Kayıt ol"}
          </button>
        ))}
      </div>

      <form
        key={mode}
        action={isSignIn ? signInAction : signUpAction}
        className="mt-6 space-y-4"
        noValidate
      >
        <input type="hidden" name="timezone" value={timezone} />
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
        <Field
          label="Şifre"
          hint={!isSignIn ? "En az 8 karakter." : undefined}
        >
          <input
            className="input"
            type="password"
            name="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            minLength={isSignIn ? undefined : 8}
            required
            placeholder="••••••••"
          />
        </Field>

        {linkError && !state && (
          <Notice tone="error">Bağlantı geçersiz ya da süresi dolmuş. Lütfen tekrar dene.</Notice>
        )}
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.message && <Notice tone="info">{state.message}</Notice>}

        <SubmitButton pendingText={isSignIn ? "Giriş yapılıyor…" : "Hesap oluşturuluyor…"}>
          {isSignIn ? "Giriş yap" : "Hesap oluştur"}
        </SubmitButton>
      </form>

      {isSignIn && (
        <Link
          href="/sifre-sifirla"
          className="mt-6 inline-block text-sm text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
        >
          Şifremi unuttum
        </Link>
      )}
    </div>
  );
}
