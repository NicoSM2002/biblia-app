"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function ChatInput({
  onSubmit,
  disabled,
  placeholder = "¿Qué quieres preguntar?",
  autoFocus,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function send() {
    const v = value.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setValue("");
  }

  const active = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn(
        "transition-opacity duration-300",
        disabled && "opacity-60",
      )}
    >
      <div className="card-input flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "flex-1 resize-none bg-transparent outline-none py-2",
            "font-sans text-[1rem] sm:text-[1.02rem] leading-[1.5] text-[var(--ink)]",
            "placeholder:text-[var(--ink-faint)]",
            "max-h-[40vh] overflow-y-auto",
          )}
          aria-label="Escribe tu pregunta"
        />
        <button
          type="button"
          onClick={send}
          disabled={!active}
          aria-label="Enviar pregunta"
          className={cn(
            "shrink-0 grid place-items-center w-10 h-10 rounded-full",
            "transition-all duration-200",
            active
              ? "bg-[var(--gold)] text-white hover:bg-[var(--gold-soft)] shadow-sm"
              : "bg-[var(--rule)] text-[var(--ink-faint)] cursor-default",
          )}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="6" y1="12" x2="18" y2="12" />
            <polyline points="13 7 18 12 13 17" />
          </svg>
        </button>
      </div>
    </form>
  );
}
