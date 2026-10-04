/**
 * Lectura por voz — one reader for the whole app, on the browser's own
 * speech synthesis (free, offline, no server).
 *
 * A tiny external store (useSyncExternalStore) rather than React context:
 * the Gospel card, each chat turn and the mini player in BottomNav all read
 * the same state, and only one text is ever being read at a time.
 *
 * Browser quirks this is shaped around:
 *  - Chrome silently stops a single utterance after ~15 s, so text is split
 *    into sentence-sized chunks and queued.
 *  - speechSynthesis.pause() is a no-op on Android Chrome, so "pause" is
 *    cancel() + remember the chunk we were on; "resume" re-queues from it.
 *  - iOS only lets speech start inside a user gesture: play()/resume() call
 *    speak() synchronously from the click handler, never after an await.
 *  - cancel() fires onend/onerror on the queued utterances; a session
 *    counter makes those stale callbacks no-ops.
 */

import { useSyncExternalStore } from "react";

export type TtsStatus = "idle" | "playing" | "paused";
export type TtsState = {
  supported: boolean;
  status: TtsStatus;
  /** Which text is loaded, e.g. "gospel:2026-10-04" or a chat turn id. */
  id: string | null;
  title: string;
  index: number;
  total: number;
  rate: number;
};

export const RATES = [0.85, 1, 1.15];

const SERVER_STATE: TtsState = {
  supported: false,
  status: "idle",
  id: null,
  title: "",
  index: 0,
  total: 0,
  rate: 1,
};

let state: TtsState = SERVER_STATE;
let chunks: string[] = [];
let session = 0;
const listeners = new Set<() => void>();

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

function set(patch: Partial<TtsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  if (state === SERVER_STATE && synth()) {
    state = { ...SERVER_STATE, supported: true };
    // Leaving or reloading the page must not keep talking (some browsers do).
    window.addEventListener("pagehide", () => synth()?.cancel());
  }
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getSnapshot = () => state;
export const getServerSnapshot = () => SERVER_STATE;

/** Current reader state; `supported` is false on the server and first paint. */
export function useTts(): TtsState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Known MALE Spanish system voices, by name — the Web Speech API exposes no
 * gender, so this is the only handle. iOS/macOS: Jorge, Juan, Diego,
 * Carlos, Eddy, Reed, Rocko… Windows/Edge: Pablo, Raúl, Álvaro, Jorge,
 * Gerardo, Alonso… Devices without one fall back to the best Spanish voice.
 */
const MALE_VOICE =
  /\b(jorge|juan|diego|carlos|pablo|ra[uú]l|[aá]lvaro|alonso|gerardo|enrique|andr[eé]s|gonzalo|tom[aá]s|jos[eé]|manuel|antonio|miguel|francisco|javier|sergio|lorenzo|eddy|reed|rocko|grandpa|male|hombre|masculin)/i;

/** Best Spanish voice: a male one first (user's choice), then quality. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = synth()?.getVoices().filter((v) => /^es\b|^es[-_]/i.test(v.lang)) ?? [];
  const score = (v: SpeechSynthesisVoice) =>
    (MALE_VOICE.test(v.name) ? 10 : 0) +
    (/natural|neural|premium|enhanced|online|google/i.test(v.name) ? 4 : 0) +
    (/es[-_](419|MX|US|AR|CO)/i.test(v.lang) ? 1 : 0) +
    (v.localService ? 0 : 1);
  return voices.sort((a, b) => score(b) - score(a))[0];
}

/** Sentence-ish chunks of at most ~220 chars (see the Chrome note above). */
export function chunkText(text: string, max = 220): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;:…])\s+/)
    .flatMap((s) => (s.length <= max ? [s] : s.split(/(?<=,)\s+/)));
  const out: string[] = [];
  for (const s of sentences) {
    const last = out[out.length - 1];
    if (last && last.length + s.length + 1 <= max) out[out.length - 1] = `${last} ${s}`;
    else if (s.trim()) out.push(s.trim());
  }
  return out;
}

function speakFrom(i: number) {
  const s = synth();
  if (!s) return;
  const mine = ++session;
  s.cancel();
  const voice = pickVoice();
  for (let j = i; j < chunks.length; j++) {
    const u = new SpeechSynthesisUtterance(chunks[j]);
    u.lang = voice?.lang ?? "es-ES";
    if (voice) u.voice = voice;
    u.rate = state.rate;
    u.onstart = () => {
      if (session === mine) set({ index: j });
    };
    if (j === chunks.length - 1) {
      u.onend = () => {
        if (session === mine) set({ status: "idle", index: 0 });
      };
    }
    u.onerror = (e) => {
      // "interrupted"/"canceled" are our own cancel(); anything else stops.
      if (session === mine && e.error !== "interrupted" && e.error !== "canceled") {
        set({ status: "idle" });
      }
    };
    s.speak(u);
  }
  set({ status: "playing", index: i });
}

/** Start reading `text`. Call straight from a click handler (iOS). */
export function play(id: string, title: string, text: string) {
  chunks = chunkText(text);
  if (!chunks.length) return;
  set({ id, title, total: chunks.length, index: 0 });
  speakFrom(0);
}

export function pause() {
  session++;
  synth()?.cancel();
  set({ status: "paused" });
}

export function resume() {
  if (state.status === "paused") speakFrom(state.index);
}

export function stop() {
  session++;
  synth()?.cancel();
  set({ status: "idle", id: null, index: 0, total: 0 });
}

/** Play/pause toggle for a given text — what every "Escuchar" button does. */
export function toggle(id: string, title: string, text: string) {
  if (state.id === id && state.status === "playing") pause();
  else if (state.id === id && state.status === "paused") resume();
  else play(id, title, text);
}

export function cycleRate() {
  const next = RATES[(RATES.indexOf(state.rate) + 1) % RATES.length];
  set({ rate: next });
  // Takes effect from the current sentence on.
  if (state.status === "playing") speakFrom(state.index);
}

/** Markdown-ish response text → something that reads well aloud. */
export function speakable(text: string): string {
  return text
    .replace(/[*_#>`]/g, "")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/[“”«»"]/g, "")
    .trim();
}
