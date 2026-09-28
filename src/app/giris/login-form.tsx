"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { Field, Notice, SubmitButton, cn } from "@/components/ui";

type Mode = "signin" | "signup";

export function LoginForm({ firstRun, canSignUp }: { firstRun: boolean; canSignUp: boolean }) {
  const [mode, setMode] = useState<Mode>(firstRun ? "signup" : "signin");
  const [signInState, signInAction] = useActionState<AuthState, FormData>(signIn, null);
  const [signUpState, signUpAction] = useActionState<AuthState, FormData>(signUp, null);
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cihaz saat dilimi yalnızca istemcide bilinir
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const isSignIn = mode === "signin";
  const state = isSignIn ? signInState : signUpState;

  return (
    <div className="rise">
      <h2 className="font-serif text-4xl tracking-tight">
        {firstRun ? "Defterini aç." : isSignIn ? "Tekrar hoş geldin." : "Yeni hesap."}
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        {firstRun
          ? "Bir kullanıcı adı ve şifre belirle. Bu ilk hesap yönetici olur."
          : isSignIn
            ? "Verilerin bulutta; hangi cihazdan girersen gir, defterin seninle."
            : "Kullanıcı adı ve şifre belirle; varsayılan kategoriler hazır olacak."}
      </p>

      {canSignUp && !firstRun && (
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
      )}

      <form
        key={mode}
        action={isSignIn ? signInAction : signUpAction}
        className={cn("space-y-4", canSignUp && !firstRun ? "mt-6" : "mt-8")}
        noValidate
      >
        <input type="hidden" name="timezone" value={timezone} />
        <Field
          label="Kullanıcı adı"
          hint={!isSignIn ? "Küçük harf, rakam, nokta, tire veya alt çizgi (3-32 karakter)." : undefined}
        >
          <input
            className="input"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={32}
            defaultValue={state?.username ?? ""}
            placeholder="ör. ahmet"
          />
        </Field>
        <Field label="Şifre" hint={!isSignIn ? "En az 8 karakter." : undefined}>
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

        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.message && <Notice tone="info">{state.message}</Notice>}

        <SubmitButton pendingText={isSignIn ? "Giriş yapılıyor…" : "Hesap oluşturuluyor…"}>
          {isSignIn ? "Giriş yap" : "Hesabı oluştur"}
        </SubmitButton>
      </form>
    </div>
  );
}
