"use client";

import { Suspense, useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BottomNav, NAV_H } from "@/components/BottomNav";
import { ReadAloudPlayer } from "@/components/ReadAloudPlayer";
import { apiUrl } from "@/lib/api-url";

// useLayoutEffect on the client (runs sync before paint), useEffect on the
// server (silences the SSR warning). Used here to restore the cached search
// from sessionStorage BEFORE the first paint — without this, /misas paints
// the empty state for one frame, then the cards "pop" in.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  // With results on screen, the search is a "where" bar; "Cambiar" opens it.
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [churches, setChurches] = useState<Church[] | null>(null);
  const [searchedFrom, setSearchedFrom] = useState<string | null>(null);
  const [searchOrigin, setSearchOrigin] = useState<SearchOrigin>(null);
  // Restore the previous search on mount so coming back from a detail page
  // (or any other in-app navigation) keeps the list and the address the
  // user typed. We use useLayoutEffect (synchronous, before paint) so the
  // restored cards land in the very first paint — using plain useEffect
  // caused a visible "mini refresh" where the empty state painted first
  // and the cards popped in a frame later.
  useIsomorphicLayoutEffect(() => {
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
      const res = await fetch(apiUrl("/api/iglesias"), {
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
        (args.coords ? "tu ubicación actual" : args.address || "");
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

  function searchNearMe() {
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
      {/* One title. It used to be "Parroquias" in the header and then
          "Misa cerca de ti" again as a heading right below it. */}
      <header className="page-head-fade px-5 sm:px-6 pt-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-2xl lg:max-w-5xl mx-auto lg:px-4">
          <h1 className="font-display text-[min(1.5rem,26px)] leading-tight text-[var(--ink)]">
            Misa cerca de ti
          </h1>
        </div>
      </header>

      <ReadAloudPlayer />

      <main
        className="page-content-fade flex-1 overflow-y-auto"
        style={{ paddingBottom: `calc(${NAV_H} + 16px)` }}
      >
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-5 sm:px-6 lg:px-10 pt-6 lg:pt-8">
          {/* Before the first search: "use my location" is THE action, so it
              is a big labelled button — it used to be an unlabelled target
              icon tucked inside the address field. Typing an address is the
              alternative, below it. */}
          {!churches && !pending && (
            <div className="flex flex-col items-center text-center pt-2">
              <span
                aria-hidden="true"
                className="grid place-items-center w-[72px] h-[84px] text-[var(--gold)]"
                style={{
                  borderRadius: "50% 50% 10px 10px / 34px 34px 10px 10px",
                  background:
                    "radial-gradient(ellipse 120% 80% at 50% 0%, color-mix(in srgb, var(--gold) 20%, transparent), transparent 70%), var(--vellum)",
                  border: "1px solid color-mix(in srgb, var(--gold) 34%, transparent)",
                }}
              >
                <ChurchGlyph />
              </span>
              <h2 className="mt-4 font-display text-[min(1.3rem,22px)] leading-[1.25] text-[var(--ink)] max-w-[22ch]" style={{ textWrap: "balance" }}>
                Encuentra parroquias y sus horarios de misa
              </h2>
              <p className="mt-2 font-sans text-[0.9rem] leading-relaxed text-[var(--ink-soft)] max-w-[34ch]">
                Usamos tu ubicación solo para buscar iglesias cercanas. No se guarda.
              </p>
              <button
                type="button"
                onClick={searchNearMe}
                className="mt-6 w-full max-w-sm inline-flex items-center justify-center gap-2 min-h-[52px] rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] font-sans text-[1rem] font-semibold hover:bg-[var(--gold-soft)] active:scale-[0.98] transition-all"
              >
                <TargetIcon />
                Usar mi ubicación
              </button>
              <p className="mt-5 mb-2 font-sans text-[0.84rem] text-[var(--ink-faint)]">
                o escribe una dirección
              </p>
              <div className="w-full max-w-sm text-left">
              <form onSubmit={onSubmit}>
                <div className="flex items-center gap-2 bg-[var(--surface)] border-[1.5px] border-[var(--rule)] rounded-full pl-4 pr-1.5 py-1.5 transition-all shadow-[0_1px_0_var(--emboss)_inset] focus-within:border-[var(--marian)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--marian)_14%,transparent)]">
                  <PinIcon className="text-[var(--ink-faint)] shrink-0" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={pending}
                    placeholder={churches ? "Otra dirección o ciudad" : "Ciudad, barrio o dirección"}
                    enterKeyHint="search"
                    className="flex-1 min-w-0 bg-transparent outline-none font-sans text-[0.95rem] text-[var(--ink)] placeholder:text-[var(--ink-faint)] py-2"
                    aria-label="Dirección o ciudad"
                  />
                  {address.trim() ? (
                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex items-center min-h-[40px] px-4 rounded-full bg-[var(--marian)] text-white font-sans text-[0.88rem] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Buscar
                    </button>
                  ) : (
                    churches && (
                      <button
                        type="button"
                        onClick={searchNearMe}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full border border-[color-mix(in_srgb,var(--marian)_35%,transparent)] bg-[color-mix(in_srgb,var(--marian)_8%,transparent)] text-[var(--marian)] font-sans text-[0.86rem] font-semibold hover:bg-[color-mix(in_srgb,var(--marian)_14%,transparent)] transition-colors disabled:opacity-50"
                      >
                        <TargetIcon />
                        Cerca de mí
                      </button>
                    )
                  )}
                </div>
              </form>
              </div>
              {error && (
                <p role="alert" className="mt-4 font-sans text-[0.92rem] text-[var(--vino)]">
                  {error}
                </p>
              )}
            </div>
          )}

          {/* With results, this is a "where am I searching" bar, not an open
              field: an input + "Cerca de mí" squeezed into one row cut the
              placeholder off ("Otra dirección o c…") and repeated what the
              line below already said. "Cambiar" opens the full search. */}
          {(churches || pending) && !editing && (
            <div className="lg:max-w-xl flex items-center gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] pl-4 pr-2 py-2 shadow-[0_1px_0_var(--emboss)_inset]">
              <PinIcon className="text-[var(--gold)] shrink-0" />
              <div className="flex-1 min-w-0">
                {pending ? (
                  <p className="font-sans text-[0.92rem] text-[var(--ink-soft)] py-2">Buscando parroquias…</p>
                ) : (
                  <>
                    <p className="font-sans text-[0.74rem] text-[var(--ink-faint)]">Buscando cerca de</p>
                    <p className="font-sans text-[0.95rem] font-medium text-[var(--ink)] truncate">
                      {searchedFrom ? searchedFrom.charAt(0).toUpperCase() + searchedFrom.slice(1) : "Tu ubicación"}
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={pending}
                className="inline-flex items-center min-h-[40px] px-4 shrink-0 rounded-full border border-[color-mix(in_srgb,var(--marian)_35%,transparent)] bg-[var(--surface)] font-sans text-[0.86rem] font-semibold text-[var(--marian)] hover:bg-[color-mix(in_srgb,var(--marian)_8%,transparent)] transition-colors disabled:opacity-50"
              >
                Cambiar
              </button>
            </div>
          )}

          {editing && (
            <form
              className="lg:max-w-xl"
              onSubmit={(e) => {
                onSubmit(e);
                if (address.trim()) setEditing(false);
              }}
            >
              {/* "Buscar" lives inside the field (like the send button on the
                  home), and the other two actions share one small row — they
                  used to be three full-size buttons wrapping onto two rows. */}
              <div className="flex items-center gap-2 bg-[var(--surface)] border-[1.5px] border-[var(--marian)] rounded-full pl-4 pr-1.5 py-1.5 shadow-[0_0_0_3px_color-mix(in_srgb,var(--marian)_14%,transparent)]">
                <PinIcon className="text-[var(--ink-faint)] shrink-0" />
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoFocus
                  placeholder="Ciudad, barrio o dirección"
                  enterKeyHint="search"
                  className="flex-1 min-w-0 bg-transparent outline-none font-sans text-[0.95rem] text-[var(--ink)] placeholder:text-[var(--ink-faint)] py-1.5"
                  aria-label="Dirección o ciudad"
                />
                <button
                  type="submit"
                  disabled={!address.trim()}
                  className="inline-flex items-center min-h-[38px] px-4 shrink-0 rounded-full bg-[var(--marian)] text-white font-sans text-[0.86rem] font-semibold hover:opacity-90 transition-opacity disabled:opacity-35"
                >
                  Buscar
                </button>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    searchNearMe();
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border border-[color-mix(in_srgb,var(--marian)_30%,transparent)] bg-[var(--surface)] text-[var(--marian)] font-sans text-[0.82rem] font-semibold hover:bg-[color-mix(in_srgb,var(--marian)_8%,transparent)] transition-colors"
                >
                  <TargetIcon />
                  Usar mi ubicación
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center min-h-[36px] px-3 rounded-full border border-[var(--rule)] bg-[var(--surface)] font-sans text-[0.82rem] font-medium text-[var(--ink-soft)] hover:border-[var(--ink-faint)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {(churches || pending) && error && (
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
            <div className="mt-5">
              <p className="font-sans text-[0.82rem] text-[var(--ink-soft)] mb-4">
                {churches.length} parroquia{churches.length === 1 ? "" : "s"}, de la más cercana a la más lejana
              </p>
              <ul className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
                {churches.map((c) => (
                  <ChurchCard
                    key={c.id}
                    church={c}
                    origin={searchOrigin}
                    onPick={() => {
                      try {
                        sessionStorage.setItem(
                          "selectedChurch",
                          JSON.stringify(c),
                        );
                      } catch {
                        // ignore
                      }
                    }}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function ChurchGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v4M10 4h4" />
      <path d="M5 21V11l7-5 7 5v10" />
      <path d="M3 21h18" />
      <rect x="10" y="14" width="4" height="7" />
    </svg>
  );
}

function ChurchCard({
  church,
  origin,
  onPick,
}: {
  church: Church;
  origin: SearchOrigin;
  onPick: () => void;
}) {
  const distanceText =
    church.distanceMeters < 1000
      ? `${Math.round(church.distanceMeters)} m`
      : `${(church.distanceMeters / 1000).toFixed(1)} km`;


  const detailHref = origin
    ? `/misas/${church.id}?lat=${origin.lat}&lng=${origin.lng}`
    : `/misas/${church.id}`;

  // We use onPointerDown (not onClick) for the data hand-off because the
  // global ViewTransitionLinks listener intercepts clicks in capture phase
  // with stopImmediatePropagation — that's by design (so React's
  // synthetic onClick on the Next.js <Link> never fires the default
  // navigation), but it also blocks any onClick we put on the link.
  // pointerdown fires earlier and isn't intercepted, so we get a
  // guaranteed chance to save state before the view transition kicks in.

  return (
    <li className="lift-on-hover bg-[var(--surface)] border border-[var(--rule)] rounded-2xl overflow-hidden shadow-[0_1px_0_var(--emboss)_inset] hover:border-[var(--marian)]">
      <div className="flex items-stretch">
        {/* Photo column — square. Falls back to a soft placeholder. */}
        {/* prefetch: fetch the detail route as soon as the card is on
            screen. Without it, tapping waited for a server round-trip
            (~0.3–0.9 s on 4G, more on a cold start) before ANYTHING moved,
            even though the card's data is already handed over. */}
        <Link
          href={detailHref}
          prefetch
          onPointerDown={onPick}
          className="block w-[110px] sm:w-[124px] shrink-0 bg-[var(--vellum)] relative"
          aria-hidden="true"
          tabIndex={-1}
        >
          {church.photoName ? (
            // 240px, not 800. This slot is 110–124 CSS px wide, so even on a
            // 3x screen 240 is plenty — we were downloading roughly seven
            // times the pixels we could show, once per result, all at the
            // same moment. That was most of the "las fotos se demoran".
            // lazy + async decoding keeps the ones below the fold off the
            // critical path entirely.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/places-photo?name=${encodeURIComponent(church.photoName)}&w=240`}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              width={124}
              height={124}
              className="absolute inset-0 w-full h-full object-cover"
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
          <Link href={detailHref} prefetch onPointerDown={onPick} className="group min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif font-medium text-[1rem] sm:text-[1.05rem] text-[var(--ink)] leading-[1.25] line-clamp-2 group-hover:text-[var(--marian)] transition-colors">
                {church.name}
              </h3>
              {/* Distance as a chip, not as grey text of the same weight as
                  everything else: it's the one value you scan a list of
                  parishes for, so it should read without being read. */}
              <span
                className="shrink-0 font-sans font-semibold text-[0.68rem] px-1.5 py-0.5 rounded-full"
                style={{
                  color: "var(--marian)",
                  backgroundColor: "color-mix(in srgb, var(--marian) 11%, transparent)",
                }}
              >
                {distanceText}
              </span>
            </div>
            {/* Used to show Google's hours for today next to a clock — but
                those are OFFICE hours, not masses. Mass times are read from
                the parish website on the detail page (too slow/costly to do
                for every card), so the card just points there. */}
            <p className="mt-1.5 flex items-center gap-1.5 font-sans text-[0.84rem] text-[var(--gold-text)] font-semibold leading-tight">
              <ClockIcon />
              Ver horarios de misa
            </p>
          </Link>

          <div className="mt-auto pt-2 flex items-center gap-1.5">
            {church.phone && (
              <a
                href={`tel:${church.phone.replace(/\s+/g, "")}`}
                aria-label={`Llamar a ${church.name}`}
                className="grid place-items-center w-9 h-9 rounded-full border border-[color-mix(in_srgb,var(--marian)_28%,transparent)] text-[var(--marian)] hover:bg-[color-mix(in_srgb,var(--marian)_10%,transparent)] transition-colors"
              >
                <PhoneIcon />
              </a>
            )}
            <a
              href={church.mapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Cómo llegar a ${church.name}`}
              className="grid place-items-center w-9 h-9 rounded-full border border-[color-mix(in_srgb,var(--marian)_28%,transparent)] text-[var(--marian)] hover:bg-[color-mix(in_srgb,var(--marian)_10%,transparent)] transition-colors"
            >
              <DirectionsIcon />
            </a>
          </div>
        </div>
      </div>
    </li>
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

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
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
