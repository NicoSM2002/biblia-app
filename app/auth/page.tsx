"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LatinCross } from "@/components/Cross";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-[var(--paper)]" />}>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode: Mode = params.get("modo") === "registro" ? "signup" : "login";
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError("Necesitas un correo.");
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setError("Necesitas una contraseña.");
      passwordRef.current?.focus();
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      passwordRef.current?.focus();
      return;
    }

    setPending(true);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error: e1 } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (e1) throw e1;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error: e1 } = await supabase.auth.signUp({
          email,
          password,
        });
        if (e1) throw e1;
        if (data.user && !data.session) {
          setInfo(
            "Te enviamos un correo para confirmar tu cuenta. Revísalo y vuelve para iniciar sesión.",
          );
        } else {
          router.replace(next);
          router.refresh();
        }
      }
    } catch (err) {
      const msg = (err as Error).message || "No pudimos completar la acción.";
      const friendly = translateAuthError(msg);
      setError(friendly);
      // Move focus to the field that's most likely the problem
      if (/correo/i.test(friendly) && !/contrase/i.test(friendly)) {
        emailRef.current?.focus();
      } else if (/contrase/i.test(friendly)) {
        passwordRef.current?.focus();
      } else {
        emailRef.current?.focus();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--paper)] overflow-y-auto">
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <Link
              href="/"
              className="flex flex-col items-center gap-2 group"
              aria-label="Volver a Habla con la Palabra"
            >
              <LatinCross className="text-[var(--gold)]" size={20} />
              <h1 className="font-serif italic text-[1.2rem] text-[var(--ink)]">
                Habla con la Palabra
              </h1>
            </Link>
            <p className="font-sans text-[0.82rem] tracking-[0.14em] uppercase text-[var(--ink-soft)] mt-3">
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-3 bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-5 shadow-sm"
            noValidate
          >
            <Field
              ref={emailRef}
              label="Correo"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              disabled={pending}
            />
            <Field
              ref={passwordRef}
              label="Contraseña"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={setPassword}
              disabled={pending}
              hint={mode === "signup" ? "Mínimo 8 caracteres" : undefined}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="grid place-items-center w-9 h-9 -mr-2 rounded-full text-[var(--ink-faint)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-colors"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />

            {error && (
              <p
                role="alert"
                className="font-sans text-[0.92rem] text-[var(--vino)] pt-1"
              >
                {error}
              </p>
            )}
            {info && (
              <p className="font-sans text-[0.92rem] text-[var(--ink-soft)] pt-1 leading-relaxed">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className={cn(
                "w-full mt-2 py-3 rounded-full font-sans text-[0.95rem] font-medium transition-colors min-h-[44px]",
                pending
                  ? "bg-[var(--rule)] text-[var(--ink-faint)] cursor-wait"
                  : "bg-[var(--gold)] text-[var(--button-on-gold)] hover:bg-[var(--gold-soft)]",
              )}
            >
              {pending
                ? "Un momento…"
                : mode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-5 text-center font-sans text-[0.92rem] text-[var(--ink-soft)]">
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-[var(--gold-text)] hover:underline font-medium"
                >
                  Créala aquí
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes una?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-[var(--gold-text)] hover:underline font-medium"
                >
                  Inicia sesión
                </button>
              </>
            )}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="font-sans text-[0.85rem] text-[var(--ink-soft)] hover:text-[var(--gold-text)]"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

const Field = function FieldImpl({
  ref,
  label,
  type,
  value,
  onChange,
  disabled,
  autoComplete,
  hint,
  suffix,
}: {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  hint?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-sans text-[0.85rem] font-medium text-[var(--ink-soft)]">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1 rounded-md border bg-[var(--surface)] border-[var(--rule)] focus-within:border-[var(--gold)] transition-colors">
        <input
          ref={ref}
          type={type}
          autoComplete={autoComplete}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "flex-1 px-3 py-2.5 rounded-md bg-transparent outline-none",
            "font-sans text-[1rem] text-[var(--ink)]",
          )}
        />
        {suffix}
      </div>
      {hint && (
        <span className="mt-1 block font-sans text-[0.78rem] text-[var(--ink-soft)]">
          {hint}
        </span>
      )}
    </label>
  );
};

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (m.includes("user already registered"))
    return "Ya hay una cuenta con ese correo. Inicia sesión.";
  if (m.includes("email rate limit"))
    return "Has solicitado muchos correos seguidos. Espera unos minutos.";
  if (m.includes("password should be at least"))
    return "La contraseña es muy corta.";
  return msg;
}
