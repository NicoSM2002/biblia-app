"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BottomNav } from "@/components/BottomNav";

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
  photoName?: string | null;
};

type SearchOrigin = { lat: number; lng: number } | null;

type CachedSearch = {
  address: string;
  churches: Church[];
  searchedFrom: string | null;
  searchOrigin: SearchOrigin;
};

const CACHE_KEY = "misasSearch";

function loadCache(): CachedSearch | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSearch;
  } catch {
    return null;
  }
}

function saveCache(c: CachedSearch) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // sessionStorage might be unavailable in private mode — non-fatal.
  }
}

export default function MisasPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-[var(--paper)]" />}>
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
  const [searchOrigin, setSearchOrigin] = useState<SearchOrigin>(null);

  // Restore the previous search on mount so coming back from a detail page
  // (or any other in-app navigation) keeps the list and the address the
  // user typed. Without this, every time you tap a parish and tap back you
  // have to retype your location — tedious if you're browsing several.
  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setAddress(cached.address);
      setChurches(cached.churches);
      setSearchedFrom(cached.searchedFrom);
      setSearchOrigin(cached.searchOrigin);
    }
  }, []);

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
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      const newChurches = json.churches as Church[];
      const newSearchedFrom =
        json.formattedAddress ||
        (args.coords ? "Tu ubicación actual" : args.address || "");
      const newOrigin: SearchOrigin = json.center
        ? { lat: json.center.lat, lng: json.center.lng }
        : args.coords ?? null;
      setChurches(newChurches);
      setSearchedFrom(newSearchedFrom);
      setSearchOrigin(newOrigin);
      saveCache({
        address: args.address ?? "",
        churches: newChurches,
        searchedFrom: newSearchedFrom,
        searchOrigin: newOrigin,
      });
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
      <header className="px-4 sm:px-6 pt-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="grid place-items-center w-10 h-10 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] transition-colors shrink-0 -ml-1"
          >
            <BackIcon />
          </Link>
          <h1 className="flex-1 font-sans text-[1rem] font-medium text-[var(--ink)]">
            Parroquias
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-7">
          <h2 className="font-serif italic text-[1.55rem] sm:text-[1.75rem] text-[var(--ink)] leading-[1.25] text-center mb-2">
            Misa cerca de ti
          </h2>
          <p className="font-sans text-[0.92rem] text-[var(--ink-soft)] leading-relaxed text-center max-w-[34ch] mx-auto mb-6">
            Encuentra iglesias católicas cercanas con horarios actualizados.
          </p>

          <form onSubmit={onSubmit}>
            <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--rule)] rounded-full pl-4 pr-1.5 py-1.5 transition-colors focus-within:border-[var(--gold)]">
              <PinIcon className="text-[var(--ink-faint)] shrink-0" />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={pending}
                placeholder="Escribe tu dirección o ciudad"
                className="flex-1 bg-transparent outline-none font-sans text-[0.95rem] text-[var(--ink)] placeholder:text-[var(--ink-faint)] py-2"
                aria-label="Dirección o ciudad"
              />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={pending}
                aria-label="Usar mi ubicación"
                className="grid place-items-center w-10 h-10 rounded-full text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-colors disabled:opacity-50"
              >
                <TargetIcon />
              </button>
            </div>
          </form>

          {error && (
            <p role="alert" className="mt-4 font-sans text-[0.92rem] text-[var(--vino)]">
              {error}
            </p>
          )}

          {pending && (
            <div className="mt-8 flex items-center gap-2 justify-center">
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
            <div className="mt-7">
              <p className="font-sans text-[0.82rem] text-[var(--ink-soft)] mb-4">
                {churches.length} resultado{churches.length === 1 ? "" : "s"} encontrado{churches.length === 1 ? "" : "s"}
                {searchedFrom && (
                  <>
                    {" cerca de "}
                    <span className="text-[var(--ink)]">{searchedFrom}</span>
                  </>
                )}
              </p>
              <ul className="space-y-3">
                {churches.map((c, i) => (
                  <ChurchCard
                    key={c.id}
                    church={c}
                    index={i}
                    origin={searchOrigin}
                  />
                ))}
              </ul>
            </div>
          )}

          {!churches && !pending && !error && (
            <div className="mt-10 text-center">
              <p className="font-serif italic text-[1.1rem] text-[var(--ink)]">
                Empieza buscando una ubicación
              </p>
              <p className="mt-2 font-sans text-[0.9rem] text-[var(--ink-soft)]">
                Escribe tu ciudad o usa el botón de ubicación.
              </p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function ChurchCard({
  church,
  index,
  origin,
}: {
  church: Church;
  index: number;
  origin: SearchOrigin;
}) {
  const distanceText =
    church.distanceMeters < 1000
      ? `${Math.round(church.distanceMeters)} m`
      : `${(church.distanceMeters / 1000).toFixed(1)} km`;

  const todayHours = pickTodayHours(church.openingHours);

  // Forward the search origin so the detail page can show distance from the
  // same point the user originally searched from (rather than the church
  // itself, which would always say "0 m").
  const detailHref = origin
    ? `/misas/${church.id}?lat=${origin.lat}&lng=${origin.lng}`
    : `/misas/${church.id}`;

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.025, duration: 0.25 }}
      className="bg-[var(--surface)] border border-[var(--rule)] rounded-xl overflow-hidden"
    >
      <div className="flex items-stretch">
        {/* Photo column — square. Falls back to a soft placeholder. */}
        <Link
          href={detailHref}
          className="block w-[110px] sm:w-[124px] shrink-0 bg-[var(--vellum)] relative"
          aria-hidden="true"
          tabIndex={-1}
        >
          {church.photoName ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/places-photo?name=${encodeURIComponent(church.photoName)}&w=320`}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              // Shared element transition: when the user taps this card, the
              // browser sees an element with the same view-transition-name
              // on the destination page (the hero photo) and morphs from
              // here to there. The id makes the name unique per church.
              style={{ viewTransitionName: `church-photo-${church.id}` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--gold-text)] opacity-50">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="10.5" y1="3.5" x2="13.5" y2="3.5" />
                <path d="M5 21V11l7-4 7 4v10" />
                <line x1="3" y1="21" x2="21" y2="21" />
                <rect x="10" y="14" width="4" height="7" />
              </svg>
            </div>
          )}
        </Link>

        {/* Content column */}
        <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col">
          <Link href={detailHref} className="group min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif text-[1rem] sm:text-[1.05rem] text-[var(--ink)] leading-[1.25] line-clamp-2 group-hover:text-[var(--gold-text)] transition-colors">
                {church.name}
              </h3>
              <span className="shrink-0 font-sans text-[0.76rem] text-[var(--ink-faint)]">
                {distanceText}
              </span>
            </div>
            {todayHours && (
              <p className="mt-1.5 font-sans text-[0.74rem] tracking-[0.06em] uppercase text-[var(--ink-faint)]">
                Próxima misa
              </p>
            )}
            <p className="font-sans text-[0.86rem] text-[var(--gold-text)] font-medium leading-tight">
              {todayHours ?? "Ver horarios"}
            </p>
          </Link>

          <div className="mt-auto pt-2 flex items-center gap-1.5">
            {church.phone && (
              <a
                href={`tel:${church.phone.replace(/\s+/g, "")}`}
                aria-label={`Llamar a ${church.name}`}
                className="grid place-items-center w-9 h-9 rounded-full border border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-colors"
              >
                <PhoneIcon />
              </a>
            )}
            <a
              href={church.mapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Cómo llegar a ${church.name}`}
              className="grid place-items-center w-9 h-9 rounded-full border border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-colors"
            >
              <DirectionsIcon />
            </a>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

/**
 * Try to extract today's opening line from Google's weekdayDescriptions array.
 * Format is e.g. "miércoles: 8:00 - 19:00" or "jueves: cerrado".
 * Falls back to null if we can't find a line for today.
 */
function pickTodayHours(lines?: string[] | null): string | null {
  if (!lines || lines.length === 0) return null;
  const days = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const today = days[new Date().getDay()];
  const line = lines.find((l) => l.toLowerCase().startsWith(today));
  if (!line) return null;
  // Strip the "today:" prefix to leave just the hours.
  const idx = line.indexOf(":");
  const rest = idx >= 0 ? line.slice(idx + 1).trim() : line;
  if (/cerrado|closed/i.test(rest)) return null;
  return `Hoy ${rest}`;
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
