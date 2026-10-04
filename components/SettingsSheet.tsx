"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadSettings,
  saveSettings,
  SCALE_STEPS,
  type FontSetting,
  type Settings,
  type ThemeSetting,
} from "@/lib/settings";

/**
 * "Aa" button + Ajustes bottom sheet: text size, colour mode, typeface.
 * Every change applies to the whole app immediately (the app behind the
 * sheet IS the preview) and is saved on this device.
 *
 * Replaces the old sun/moon ThemeToggle in the home header: "Aa" is the
 * reading-settings glyph people know from Safari Reader, Kindle and Books,
 * and it works without an account (the avatar menu leads to sign-up).
 */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ajustes de lectura"
        aria-haspopup="dialog"
        title="Ajustes"
        className="grid place-items-center w-11 h-11 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] active:scale-95 transition-all shrink-0"
        style={{ touchAction: "manipulation" }}
      >
        <span aria-hidden="true" className="font-display leading-none">
          <span className="text-[0.82rem]">A</span>
          <span className="text-[1.12rem]">a</span>
        </span>
      </button>
      {/* Portal to <body>: the header's fade-in animation makes it a stacking
          context, which trapped the sheet's z-index under <main>. */}
      {open && createPortal(<SettingsSheet onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

const THEMES: { value: ThemeSetting; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Claro", icon: <SunIcon /> },
  { value: "dark", label: "Oscuro", icon: <MoonIcon /> },
  { value: "system", label: "Sistema", icon: <PhoneIcon /> },
];

const FONTS: { value: FontSetting; label: string; family: string }[] = [
  { value: "clasica", label: "Clásica", family: "var(--font-newsreader), Georgia, serif" },
  { value: "sencilla", label: "Sencilla", family: "var(--font-sans), system-ui, sans-serif" },
];

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  // Esc closes, Tab stays inside the sheet, focus returns to the "Aa"
  // button on close — same contract as HistorySheet.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sheetRef.current) return;
      const f = sheetRef.current.querySelectorAll<HTMLElement>(
        "button, input, [tabindex]:not([tabindex='-1'])",
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  const stepIndex = Math.max(0, SCALE_STEPS.indexOf(settings.scale));

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-[var(--scrim)] backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="settings-sheet fixed inset-x-0 bottom-0 z-[61] max-w-2xl mx-auto max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--rule)] bg-[var(--paper)] shadow-[0_-8px_30px_rgba(0,0,0,0.14)]"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[var(--rule)]" />

        <header className="px-5 pt-3 pb-3 flex items-center justify-between">
          <div>
            <p className="font-sans text-[0.68rem] tracking-[0.2em] uppercase text-[var(--gold-text)] font-semibold">
              Lectura
            </p>
            <h2 id="settings-title" className="font-display text-[1.36rem] text-[var(--ink)] mt-0.5">
              Ajustes
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
            className="grid place-items-center w-11 h-11 rounded-full bg-[var(--vellum)] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="px-5 space-y-6">
          {/* Tamaño del texto */}
          <section>
            <Label htmlFor="settings-scale">Tamaño del texto</Label>
            <div className="mt-3 flex items-center gap-3">
              <span aria-hidden="true" className="font-display text-[0.85rem] text-[var(--ink-soft)] w-4 text-center">A</span>
              <input
                id="settings-scale"
                type="range"
                min={0}
                max={SCALE_STEPS.length - 1}
                step={1}
                value={stepIndex}
                onChange={(e) => update({ scale: SCALE_STEPS[Number(e.target.value)] })}
                aria-valuetext={`${Math.round(settings.scale * 100)} %`}
                className="settings-range flex-1"
              />
              <span aria-hidden="true" className="font-display text-[1.35rem] text-[var(--ink-soft)] w-4 text-center">A</span>
            </div>
            <p className="mt-3 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] px-4 py-3 font-serif text-[1.08rem] leading-[1.44] text-[var(--ink)]">
              Antorcha para mis pies es tu palabra, y luz para mi senda.
              <span className="block mt-1 font-sans text-[0.7rem] tracking-[0.16em] uppercase text-[var(--gold-text)]">
                Salmo 119 · 105
              </span>
            </p>
          </section>

          {/* Modo de visualización */}
          <section>
            <Label id="settings-theme">Modo de visualización</Label>
            <Segmented
              labelledBy="settings-theme"
              options={THEMES.map((t) => ({
                value: t.value,
                content: (
                  <>
                    {t.icon}
                    <span>{t.label}</span>
                  </>
                ),
              }))}
              value={settings.theme}
              onChange={(theme) => update({ theme })}
            />
            <p className="mt-2 font-sans text-[0.8rem] text-[var(--ink-faint)]">
              «Sistema» sigue el modo claro u oscuro de tu teléfono.
            </p>
          </section>

          {/* Tipo de letra */}
          <section>
            <Label id="settings-font">Tipo de letra</Label>
            <Segmented
              labelledBy="settings-font"
              options={FONTS.map((f) => ({
                value: f.value,
                content: (
                  <span style={{ fontFamily: f.family }} className="text-[1.02rem]">
                    {f.label}
                  </span>
                ),
              }))}
              value={settings.font}
              onChange={(font) => update({ font })}
            />
            <p className="mt-2 font-sans text-[0.8rem] text-[var(--ink-faint)]">
              Se aplica a los versículos y a las respuestas.
            </p>
          </section>

          <p className="pb-1 text-center font-sans text-[0.76rem] text-[var(--ink-faint)]">
            Los ajustes se guardan en este dispositivo.
          </p>
        </div>
      </div>
    </>
  );
}

function Label({ children, id, htmlFor }: { children: React.ReactNode; id?: string; htmlFor?: string }) {
  const cls = "block font-sans text-[0.95rem] font-semibold text-[var(--ink)]";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>{children}</label>
  ) : (
    <p id={id} className={cls}>{children}</p>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: { value: T; content: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  labelledBy: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="mt-3 grid gap-1 rounded-2xl bg-[var(--vellum)] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex items-center justify-center gap-1.5 min-h-[46px] rounded-xl font-sans text-[0.86rem] font-medium transition-all active:scale-[0.97] ${
              selected
                ? "bg-[var(--surface)] text-[var(--gold-text)] border border-[color-mix(in_srgb,var(--gold)_50%,transparent)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "border border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            {o.content}
          </button>
        );
      })}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}
