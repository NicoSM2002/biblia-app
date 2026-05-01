"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Persistent bottom navigation — four sections:
 *   Inicio · Conversación · Oración · Parroquias
 *
 * Active tab gets two cues working together:
 *   1. A vellum pill behind the icon + label (color hierarchy).
 *   2. A filled icon variant (form hierarchy) — the inactive icons are
 *      stroke-only, active ones are filled. This gives peripheral
 *      recognition: a glance at the nav tells you where you are without
 *      reading labels, the way native iOS / Material apps do it.
 *
 * State changes animate (transition-all 200ms) instead of snapping —
 * Material spec calls for smooth state-layer transitions.
 */
type Item = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const items: Item[] = [
  { href: "/", label: "Inicio", icon: (a) => <HomeIcon active={a} /> },
  { href: "/chat", label: "Conversación", icon: (a) => <ChatIcon active={a} /> },
  { href: "/oracion", label: "Oración", icon: (a) => <MicIcon active={a} /> },
  { href: "/misas", label: "Parroquias", icon: (a) => <ChurchIcon active={a} /> },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/auth")) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-40 bg-[var(--paper)] border-t border-[var(--rule)] no-print"
    >
      <ul className="max-w-2xl mx-auto flex items-stretch justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-2xl min-h-[52px] active:scale-95",
                  "transition-all duration-200 ease-out",
                  active
                    ? "bg-[var(--vellum)] text-[var(--gold-text)] font-medium"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)] hover:bg-[var(--vellum)]/50",
                )}
              >
                <span aria-hidden="true">{item.icon(active)}</span>
                <span className="font-sans text-[0.74rem] tracking-[0.01em]">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Each icon: stroke-only when inactive, gently filled when active. The
 *  fill uses currentColor at low opacity so it picks up the gold-text
 *  accent of the active state without us having to hardcode a hex. */
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path
        d="M21 12a8 8 0 0 1-11.5 7.18L4 20.5l1.32-4.16A8 8 0 1 1 21 12z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}

function ChurchIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="10.5" y1="3.5" x2="13.5" y2="3.5" />
      <path
        d="M5 21V11l7-4 7 4v10"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
      <line x1="3" y1="21" x2="21" y2="21" />
      <rect x="10" y="14" width="4" height="7" />
    </svg>
  );
}
