"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LatinCross } from "@/components/Cross";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[var(--paper)]" />}>
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError("Necesitas un correo y una contraseña.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
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
      setError(translateAuthError(msg));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--paper)]">
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
            <p className="font-sans text-[0.78rem] tracking-[0.14em] uppercase text-[var(--ink-faint)] mt-3">
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-3 bg-white border border-[var(--rule)] rounded-xl p-5 shadow-sm"
          >
            <Field
              label="Correo"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              disabled={pending}
            />
            <Field
              label="Contraseña"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={setPassword}
              disabled={pending}
              hint={mode === "signup" ? "Mínimo 8 caracteres" : undefined}
            />

            {error && (
              <p className="font-sans text-[0.85rem] text-[var(--vino)] pt-1">
                {error}
              </p>
            )}
            {info && (
              <p className="font-sans text-[0.85rem] text-[var(--ink-soft)] pt-1 leading-relaxed">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className={cn(
                "w-full mt-2 py-2.5 rounded-full font-sans text-[0.95rem] font-medium transition-colors",
                pending
                  ? "bg-[var(--rule)] text-[var(--ink-faint)] cursor-wait"
                  : "bg-[var(--gold)] text-white hover:bg-[var(--gold-soft)]",
              )}
            >
              {pending
                ? "Un momento…"
                : mode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-5 text-center font-sans text-[0.85rem] text-[var(--ink-soft)]">
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
              className="font-sans text-[0.78rem] text-[var(--ink-faint)] hover:text-[var(--gold-text)]"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  disabled,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="font-sans text-[0.78rem] text-[var(--ink-soft)]">
        {label}
      </span>
      <input
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 w-full px-3 py-2 rounded-md border bg-white outline-none transition-colors",
          "border-[var(--rule)] focus:border-[var(--gold)]",
          "font-sans text-[0.96rem] text-[var(--ink)]",
        )}
      />
      {hint && (
        <span className="mt-1 block font-sans text-[0.72rem] text-[var(--ink-faint)]">
          {hint}
        </span>
      )}
    </label>
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
