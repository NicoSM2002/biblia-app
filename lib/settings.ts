/**
 * Ajustes de lectura — text size, colour mode and typeface — persisted per
 * device in localStorage and applied to <html> before first paint.
 *
 * Defaults keep the app's long-standing behaviour: light theme on first paint
 * regardless of the OS setting (see app/layout.tsx). A different theme only
 * sticks when the user picks it here. Stored under a NEW key ("ajustes")
 * because layout.tsx deliberately wipes the old "theme" key from earlier
 * builds that persisted dark mode by accident.
 *
 * The apply logic lives in APPLY_SRC as plain ES5 source so the exact same
 * code runs in the pre-paint inline script (layout.tsx) and at runtime when a
 * setting changes (applySettings below). One implementation, no drift.
 */

export type ThemeSetting = "light" | "dark" | "system";
export type FontSetting = "clasica" | "sencilla";
export type Settings = {
  theme: ThemeSetting;
  /** Root font-size multiplier. Every type size in the app is in rem. */
  scale: number;
  font: FontSetting;
};

export const SETTINGS_KEY = "ajustes";
export const DEFAULT_SETTINGS: Settings = { theme: "light", scale: 1, font: "clasica" };
export const SCALE_STEPS = [0.9, 1, 1.1, 1.2, 1.3];

/** theme-color for the mobile browser bar — must match --paper per theme. */
const PAPER = { light: "#FAF6EE", dark: "#14100C" };

const APPLY_SRC = `function(s){
  var d=document.documentElement;
  var dark=s.theme==='dark'||(s.theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  d.setAttribute('data-theme',dark?'dark':'light');
  d.setAttribute('data-font',s.font==='sencilla'?'sencilla':'clasica');
  d.style.fontSize=(s.scale&&s.scale!==1)?(s.scale*100)+'%':'';
  var m=document.querySelector('meta[name="theme-color"]');
  if(m)m.setAttribute('content',dark?'${PAPER.dark}':'${PAPER.light}');
}`;

const applyFn = new Function(`return ${APPLY_SRC}`)() as (s: Settings) => void;

/** Inline <head> script: read saved settings and apply before paint. */
export const SETTINGS_INIT_SCRIPT = `(function(){try{
  var s=JSON.parse(localStorage.getItem('${SETTINGS_KEY}')||'null');
  if(s)(${APPLY_SRC})(s);
}catch(e){}})();`;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // private mode / blocked storage — defaults
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // still applied for this session
  }
  applySettings(s);
}

export function applySettings(s: Settings): void {
  applyFn(s);
}

/**
 * Save + apply with a clean whole-screen crossfade when the colour mode
 * changes. Without this every element transitioned on its own clock (page
 * 280 ms, pills 150 ms, the rest instantly) and for a moment the screen was
 * a patchwork — a bright white "Claro" pill on black, muddy grey buttons.
 * Now all transitions are frozen during the swap and the View Transitions
 * API fades the old screen into the new one; without it the swap is
 * instant (still clean). Reduced-motion users always get the instant swap.
 */
export function saveSettingsSmooth(next: Settings, prev: Settings): void {
  const root = document.documentElement;
  const themeChanged = next.theme !== prev.theme;
  if (!themeChanged) {
    saveSettings(next);
    return;
  }
  root.classList.add("theme-switching");
  const done = () =>
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) {
    doc.startViewTransition(() => saveSettings(next)).finished.finally(done);
  } else {
    saveSettings(next);
    done();
  }
}
