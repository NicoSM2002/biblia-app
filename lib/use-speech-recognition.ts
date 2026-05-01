"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps the browser's Web Speech API (SpeechRecognition) for the kind of
 * "tap mic, dictate, tap stop" flow this app needs. Keeps the hook simple:
 *
 *   const { listening, transcript, supported, start, stop, reset } =
 *     useSpeechRecognition();
 *
 * - `transcript` updates in real time (interim results) while the user
 *   speaks, so callers can mirror it into a controlled input as it grows.
 * - `start()` triggers the browser permission prompt the first time.
 * - `stop()` ends the session; `reset()` clears the buffered text.
 * - `supported === false` means the browser doesn't expose the API
 *   (older Android browsers, Firefox, etc.) — caller should hide the mic.
 *
 * iOS Safari (14.5+) supports `webkitSpeechRecognition`. Chrome / Edge
 * also use the webkit-prefixed name on Android. Desktop Firefox does
 * not support this API at all.
 */

// The W3C type for SpeechRecognition isn't in lib.dom yet, so we model
// just what we use.
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
    length: number;
  }>;
};
type SpeechRecognitionErrorEvent = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WindowWithSR = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function getSRConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithSR;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(opts?: { lang?: string }) {
  const lang = opts?.lang ?? "es-ES";
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Once a session ends with a "final" result, lock that text so subsequent
  // sessions append rather than wiping the buffer.
  const finalRef = useRef<string>("");

  useEffect(() => {
    const Ctor = getSRConstructor();
    if (!Ctor) return;
    setSupported(true);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = "";
      let appendedFinal = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          appendedFinal += text;
        } else {
          interim += text;
        }
      }
      if (appendedFinal) {
        finalRef.current = (finalRef.current + " " + appendedFinal).trim();
      }
      const combined = (finalRef.current + " " + interim).trim();
      setTranscript(combined);
    };
    rec.onerror = (e) => {
      setError(e.error || "speech-recognition-error");
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    return () => {
      rec.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || listening) return;
    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if called while already started; ignore.
    }
  }, [listening]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.stop();
    // onend will flip listening to false
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}
