"use client";

import { BottomNav } from "@/components/BottomNav";

export default function OracionPage() {
  return (
    <div className="relative h-[100dvh] flex flex-col bg-[var(--paper)]">
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="text-center max-w-md">
          <p className="font-sans text-[0.78rem] tracking-[0.22em] uppercase text-[var(--gold-text)] mb-3">
            Modo oración
          </p>
          <h1 className="font-serif italic text-[1.6rem] sm:text-[1.85rem] text-[var(--ink)] leading-[1.3] mb-4">
            Tómate un momento para hablar con Él.
          </h1>
          <p className="font-sans text-[0.95rem] text-[var(--ink-soft)] leading-relaxed">
            Esta sección estará disponible pronto. Un espacio para respirar
            en silencio, con un versículo para meditar.
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
