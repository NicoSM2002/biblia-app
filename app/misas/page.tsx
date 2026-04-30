"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { LatinCross } from "@/components/Cross";
import { cn } from "@/lib/utils";

type Church = {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  distanceMeters: number;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  openingHours?: string[] | null;
  mapsUrl: string;
};

export default function MisasPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[var(--paper)]" />}>
      <Misas />
    </Suspense>
  );
}

function Misas() {
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [churches, setChurches] = useState<Church[] | null>(null);
  const [searchedFrom, setSearchedFrom] = useState<string | null>(null);

  async function search(args: {
    address?: string;
    coords?: { lat: number; lng: number };
  }) {
    setError(null);
    setChurches(null);
    setPending(true);
    try {
      const res = await fetch("/api/iglesias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: args.address,
          lat: args.coords?.lat,
          lng: args.coords?.lng,
          radius: 8000,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Error ${res.status}`);
      }
      setChurches(json.churches as Church[]);
      setSearchedFrom(
        json.formattedAddress ||
          (args.coords ? "Tu ubicación actual" : args.address || ""),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    void search({ address: address.trim() });
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }
    setPending(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void search({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      (err) => {
        setPending(false);
        setError(
          err.code === 1
            ? "Necesitamos permiso de ubicación para buscar cerca de ti."
            : "No pudimos obtener tu ubicación. Intenta escribir tu dirección.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden bg-[var(--paper)]">
      <div className="missal-page">
      <header className="relative z-30 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-6 lg:pt-7 pb-4 lg:pb-5 border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            title="Volver al inicio"
            className="grid place-items-center w-11 h-11 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--gold-text)] transition-colors shrink-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="flex items-center gap-2 sm:gap-3 min-w-0 group ml-1"
          >
            <LatinCross
              className="text-[var(--gold-text)] shrink-0 transition-opacity group-hover:opacity-80"
              size={14}
            />
            <h1 className="font-sans text-[1rem] sm:text-[1.05rem] font-medium text-[var(--ink)] truncate transition-colors group-hover:text-[var(--gold-text)]">
              Habla con la Palabra
            </h1>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto min-h-0 px-4 sm:px-8 lg:px-10 py-8">
        <div className="max-w-2xl mx-auto">
          <p className="font-sans text-[0.7rem] tracking-[0.18em] uppercase text-[var(--gold-text)] mb-2">
            Misa cerca de ti
          </p>
          <h2 className="font-serif italic text-[1.5rem] sm:text-[1.85rem] text-[var(--ink)] leading-[1.3] mb-2">
            Encuentra una parroquia cercana.
          </h2>
          <p className="font-sans text-[0.92rem] text-[var(--ink-soft)] leading-relaxed mb-6">
            Escribe tu dirección o usa tu ubicación. Te mostramos las
            iglesias católicas más cercanas con su sitio web y teléfono —
            los horarios de Misa actualizados los confirma cada parroquia
            en su web.
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="card-input flex items-end gap-2">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={pending}
                placeholder="Tu dirección, barrio o ciudad"
                className="flex-1 bg-transparent outline-none py-2 font-sans text-[1rem] text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
                aria-label="Dirección"
              />
              <button
                type="submit"
                disabled={pending || !address.trim()}
                aria-label="Buscar"
                className={cn(
                  "shrink-0 grid place-items-center w-11 h-11 rounded-full transition-all",
                  address.trim() && !pending
                    ? "bg-[var(--gold)] text-white hover:bg-[var(--gold-soft)]"
                    : "bg-[var(--rule)] text-[var(--ink-faint)] cursor-default",
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)]" />
              <span className="font-sans text-[0.7rem] tracking-[0.16em] uppercase text-[var(--ink-faint)]">
                o
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)]" />
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={pending}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full border border-[var(--rule)] bg-white text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-all duration-200 disabled:opacity-60"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
                <line x1="2" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="22" y2="12" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="font-sans text-[0.92rem] font-medium">
                Usar mi ubicación
              </span>
            </button>
          </form>

          {error && (
            <p className="mt-4 font-sans text-[0.92rem] text-[var(--vino)]">
              {error}
            </p>
          )}

          {pending && (
            <div className="mt-8 flex items-center gap-3">
              <span className="flex items-center gap-[5px]">
                <span className="dot-1 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
                <span className="dot-2 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
                <span className="dot-3 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
              </span>
              <span className="font-sans text-[0.84rem] text-[var(--ink-faint)]">
                Buscando iglesias…
              </span>
            </div>
          )}

          {churches && (
            <div className="mt-8">
              <p className="font-sans text-[0.78rem] text-[var(--ink-faint)] mb-3">
                {churches.length} iglesia{churches.length === 1 ? "" : "s"} cerca de{" "}
                <span className="text-[var(--ink)]">{searchedFrom}</span>
              </p>
              <ul className="space-y-3">
                {churches.map((c, i) => (
                  <ChurchCard key={c.id} church={c} index={i} />
                ))}
              </ul>
              <p className="mt-6 font-sans text-[0.78rem] text-[var(--ink-faint)] leading-relaxed">
                Los horarios reales de Misa los confirma cada parroquia.
                Toca el sitio web o llama para asegurarte antes de ir.
              </p>
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

function ChurchCard({ church, index }: { church: Church; index: number }) {
  const distanceText =
    church.distanceMeters < 1000
      ? `${Math.round(church.distanceMeters)} m`
      : `${(church.distanceMeters / 1000).toFixed(1)} km`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="bg-white border border-[var(--rule)] rounded-lg p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-serif text-[1.05rem] text-[var(--ink)] leading-snug">
          {church.name}
        </h3>
        <span className="shrink-0 font-sans text-[0.75rem] tracking-[0.08em] uppercase text-[var(--gold-text)]">
          {distanceText}
        </span>
      </div>
      <p className="font-sans text-[0.86rem] text-[var(--ink-soft)] leading-relaxed">
        {church.address}
      </p>

      {church.openingHours && church.openingHours.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer font-sans text-[0.78rem] text-[var(--ink-faint)] hover:text-[var(--gold-text)] select-none">
            <span className="group-open:hidden">Ver horario de la parroquia</span>
            <span className="hidden group-open:inline">Ocultar horario</span>
          </summary>
          <ul className="mt-2 space-y-1 font-sans text-[0.82rem] text-[var(--ink-soft)]">
            {church.openingHours.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 font-sans text-[0.72rem] text-[var(--ink-faint)] italic">
            Estos son los horarios que la parroquia publicó en Google.
            Confirma con su web o teléfono antes de ir.
          </p>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={church.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--rule)] hover:border-[var(--gold)] hover:bg-[var(--vellum)] font-sans text-[0.78rem] text-[var(--ink-soft)] hover:text-[var(--gold-text)] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Ver en Maps
        </a>
        {church.website && (
          <a
            href={church.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--rule)] hover:border-[var(--gold)] hover:bg-[var(--vellum)] font-sans text-[0.78rem] text-[var(--ink-soft)] hover:text-[var(--gold-text)] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Sitio web
          </a>
        )}
        {church.phone && (
          <a
            href={`tel:${church.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--rule)] hover:border-[var(--gold)] hover:bg-[var(--vellum)] font-sans text-[0.78rem] text-[var(--ink-soft)] hover:text-[var(--gold-text)] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Llamar
          </a>
        )}
      </div>
    </motion.li>
  );
}
