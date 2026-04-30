"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import {
  createClient,
  hasSessionCookie,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export default function GuardadosPage() {
  const [signedIn, setSignedIn] = useState<boolean>(() =>
    isSupabaseConfigured() ? hasSessionCookie() : false,
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="relative h-[100dvh] flex flex-col bg-[var(--paper)]">
      <header className="px-5 pt-5 pb-3 border-b border-[var(--rule)]">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif italic text-[1.4rem] text-[var(--ink)]">
            Guardados
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 text-center">
        {signedIn ? (
          <div className="max-w-md">
            <p className="font-serif italic text-[1.3rem] text-[var(--ink)] mb-3">
              Aún no tienes versículos guardados.
            </p>
            <p className="font-sans text-[0.95rem] text-[var(--ink-soft)] leading-relaxed">
              Cuando guardes un versículo desde una conversación, aparecerá aquí
              para que puedas volver a él cuando quieras.
            </p>
          </div>
        ) : (
          <div className="max-w-md">
            <p className="font-serif italic text-[1.3rem] text-[var(--ink)] mb-3">
              Inicia sesión para guardar tus versículos
            </p>
            <p className="font-sans text-[0.95rem] text-[var(--ink-soft)] leading-relaxed mb-6">
              Con una cuenta puedes guardar versículos y conversaciones para
              volver a ellos cuando los necesites.
            </p>
            <Link
              href="/auth?modo=registro&next=/guardados"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] font-sans text-[0.95rem] font-medium hover:bg-[var(--gold-soft)] transition-colors min-h-[44px]"
            >
              Crear cuenta
            </Link>
            <p className="mt-4 font-sans text-[0.85rem] text-[var(--ink-soft)]">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/auth?next=/guardados"
                className="text-[var(--gold-text)] hover:underline font-medium"
              >
                Inicia sesión
              </Link>
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
