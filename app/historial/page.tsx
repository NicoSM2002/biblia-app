/**
 * /historial — list the signed-in user's past conversations.
 * Server component; redirects to /auth if not signed in.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LatinCross } from "@/components/Cross";

export const dynamic = "force-dynamic";

export default async function HistorialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/historial");
  }

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--paper)]">
      <header className="px-5 sm:px-8 py-5 border-b border-[var(--rule)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <LatinCross className="text-[var(--gold)]" size={14} />
            <h1 className="font-sans text-[1rem] font-medium text-[var(--ink)]">
              Habla con la Palabra
            </h1>
          </Link>
          <Link
            href="/"
            className="font-sans text-[0.78rem] tracking-[0.12em] uppercase text-[var(--ink-faint)] hover:text-[var(--gold)] transition-colors"
          >
            Volver
          </Link>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <p className="font-sans text-[0.7rem] tracking-[0.18em] uppercase text-[var(--gold)] mb-2">
            Mi historial
          </p>
          <h2 className="font-serif italic text-[1.5rem] sm:text-[1.7rem] text-[var(--ink)] mb-6">
            Tus conversaciones con la Palabra
          </h2>

          {!conversations || conversations.length === 0 ? (
            <p className="font-sans text-[0.95rem] text-[var(--ink-soft)] leading-relaxed">
              Aún no tienes conversaciones guardadas. Cuando vuelvas a
              hablar con la Palabra, las que tengas estando con sesión
              quedarán aquí.
            </p>
          ) : (
            <ul className="space-y-2">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/historial/${c.id}`}
                    className="block bg-white border border-[var(--rule)] rounded-lg px-4 py-3 hover:border-[var(--gold)] hover:bg-[var(--vellum)] transition-colors"
                  >
                    <p className="font-serif italic text-[1rem] text-[var(--ink)] line-clamp-2">
                      {c.title || "(sin título)"}
                    </p>
                    <p className="font-sans text-[0.74rem] text-[var(--ink-faint)] mt-1">
                      {new Date(c.updated_at).toLocaleDateString("es-ES", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
