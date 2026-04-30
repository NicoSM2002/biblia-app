"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

type ChurchDetail = {
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
  photoNames: string[];
  description?: string | null;
};

export default function ChurchDetailPage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = use(params);
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-[var(--paper)]" />}>
      <ChurchDetail placeId={placeId} />
    </Suspense>
  );
}

function ChurchDetail({ placeId }: { placeId: string }) {
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  const [church, setChurch] = useState<ChurchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setChurch(null);

    const params = new URLSearchParams();
    if (lat) params.set("lat", lat);
    if (lng) params.set("lng", lng);
    const qs = params.toString();
    const url = `/api/iglesias/${encodeURIComponent(placeId)}${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
        if (!cancelled) setChurch(json.church as ChurchDetail);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [placeId, lat, lng]);

  if (error) {
    return (
      <div className="relative h-[100dvh] flex flex-col bg-[var(--paper)]">
        <DetailHeader title="Parroquia" />
        <main className="flex-1 grid place-items-center px-6 pb-24 text-center">
          <div className="max-w-sm">
            <p className="font-serif italic text-[1.2rem] text-[var(--ink)] mb-2">
              No pudimos cargar esta parroquia
            </p>
            <p className="font-sans text-[0.9rem] text-[var(--ink-soft)]">{error}</p>
            <Link
              href="/misas"
              className="inline-block mt-4 font-sans text-[0.9rem] font-medium text-[var(--gold-text)] hover:underline"
            >
              ← Volver a parroquias
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="relative h-[100dvh] flex flex-col bg-[var(--paper)]">
        <DetailHeader title="Parroquia" />
        <main className="flex-1 grid place-items-center px-6 pb-24">
          <div className="flex items-center gap-2">
            <span className="dot-1 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
            <span className="dot-2 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
            <span className="dot-3 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const distanceText =
    church.distanceMeters < 1000
      ? `${Math.round(church.distanceMeters)} m`
      : `${(church.distanceMeters / 1000).toFixed(1)} km`;

  const photos = church.photoNames.length > 0
    ? church.photoNames
    : church.photoName
      ? [church.photoName]
      : [];

  return (
    <div className="relative h-[100dvh] flex flex-col bg-[var(--paper)] overflow-hidden">
      <DetailHeader title={church.name} />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto">
          {/* Photo carousel */}
          <div className="relative bg-[var(--vellum)] aspect-[4/3] sm:aspect-[16/10] overflow-hidden">
            {photos.length > 0 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/places-photo?name=${encodeURIComponent(photos[photoIdx])}&w=1200`}
                  alt={church.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {photos.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        aria-label={`Ver foto ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${
                          i === photoIdx
                            ? "w-5 bg-white"
                            : "w-1.5 bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[var(--gold-text)] opacity-50">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="5" />
                  <line x1="10.5" y1="3.5" x2="13.5" y2="3.5" />
                  <path d="M5 21V11l7-4 7 4v10" />
                  <line x1="3" y1="21" x2="21" y2="21" />
                  <rect x="10" y="14" width="4" height="7" />
                </svg>
              </div>
            )}
          </div>

          <div className="px-5 sm:px-6 pt-6">
            <h1 className="font-serif italic text-[1.55rem] sm:text-[1.85rem] leading-[1.2] text-[var(--ink)]">
              {church.name}
            </h1>

            <div className="mt-3 flex items-start gap-2">
              <span className="text-[var(--gold-text)] mt-0.5 shrink-0">
                <PinIcon />
              </span>
              <p className="font-sans text-[0.92rem] text-[var(--ink-soft)] leading-relaxed">
                {church.address}
              </p>
            </div>

            <p className="mt-2 font-sans text-[0.85rem] text-[var(--ink-faint)]">
              {distanceText}
              {church.rating ? (
                <>
                  {" · "}
                  <span className="text-[var(--ink-soft)]">
                    ★ {church.rating.toFixed(1)}
                    {church.userRatingCount
                      ? ` (${church.userRatingCount})`
                      : ""}
                  </span>
                </>
              ) : null}
            </p>

            <div className="mt-5 flex items-center gap-2">
              <a
                href={church.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--gold)] hover:bg-[var(--vellum)] transition-colors min-h-[44px]"
              >
                <DirectionsIcon /> <span className="font-sans text-[0.92rem] font-medium">Cómo llegar</span>
              </a>
              {church.phone && (
                <a
                  href={`tel:${church.phone.replace(/\s+/g, "")}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--gold)] hover:bg-[var(--vellum)] transition-colors min-h-[44px]"
                >
                  <PhoneIcon /> <span className="font-sans text-[0.92rem] font-medium">Llamar</span>
                </a>
              )}
            </div>

            {church.openingHours && church.openingHours.length > 0 && (
              <section className="mt-8">
                <p className="font-sans text-[0.72rem] tracking-[0.18em] uppercase text-[var(--gold-text)] font-semibold mb-3">
                  Próximas misas
                </p>
                <ul className="space-y-2">
                  {church.openingHours.map((line) => {
                    const idx = line.indexOf(":");
                    const day = idx >= 0 ? line.slice(0, idx) : line;
                    const hours = idx >= 0 ? line.slice(idx + 1).trim() : "";
                    const isToday = day.toLowerCase() === todayName();
                    return (
                      <li
                        key={line}
                        className={`flex items-baseline justify-between gap-3 py-2 border-b border-[var(--rule)] last:border-b-0 ${
                          isToday ? "" : ""
                        }`}
                      >
                        <span
                          className={`font-sans text-[0.92rem] ${
                            isToday
                              ? "text-[var(--ink)] font-medium"
                              : "text-[var(--ink-soft)]"
                          }`}
                        >
                          {capitalize(day)}
                          {isToday && (
                            <span className="ml-2 font-sans text-[0.7rem] tracking-[0.1em] uppercase text-[var(--gold-text)]">
                              Hoy
                            </span>
                          )}
                        </span>
                        <span
                          className={`font-sans text-[0.88rem] text-right ${
                            isToday
                              ? "text-[var(--gold-text)] font-medium"
                              : "text-[var(--ink-soft)]"
                          }`}
                        >
                          {hours || "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 font-sans text-[0.72rem] text-[var(--ink-faint)] italic">
                  Estos son los horarios que la parroquia publicó en Google.
                  Confirma con su web o teléfono antes de ir.
                </p>
              </section>
            )}

            {church.description && (
              <section className="mt-8">
                <p className="font-sans text-[0.72rem] tracking-[0.18em] uppercase text-[var(--gold-text)] font-semibold mb-3">
                  Sobre la parroquia
                </p>
                <p className="font-sans text-[0.95rem] text-[var(--ink)] leading-relaxed">
                  {church.description}
                </p>
              </section>
            )}

            {church.website && (
              <section className="mt-6">
                <a
                  href={church.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-sans text-[0.92rem] text-[var(--gold-text)] hover:underline"
                >
                  <GlobeIcon /> Sitio web de la parroquia
                </a>
              </section>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function DetailHeader({ title }: { title: string }) {
  return (
    <header className="px-4 sm:px-6 pt-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper)] z-10">
      <div className="max-w-2xl mx-auto flex items-center gap-2">
        <Link
          href="/misas"
          aria-label="Volver a parroquias"
          className="grid place-items-center w-10 h-10 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] transition-colors shrink-0 -ml-1"
        >
          <BackIcon />
        </Link>
        <h1 className="flex-1 font-sans text-[1rem] font-medium text-[var(--ink)] truncate">
          {title}
        </h1>
      </div>
    </header>
  );
}

function todayName(): string {
  const days = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  return days[new Date().getDay()];
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
