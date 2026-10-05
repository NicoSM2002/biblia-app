"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LatinCross } from "@/components/Cross";

/**
 * Persistent bottom navigation — five sections:
 *   Inicio · Conversación · Favoritas · Oración · Parroquias
 *
 * Favoritas sits next to Conversación because that's where hearts are given.
 * It's a tab (not a menu entry) so saved answers are one tap away; for
 * guests it explains that saving needs an account.
 *
 * The active tab gets three cues working together:
 *   1. A marian-blue capsule behind the ICON (not the whole tab), the way
 *      iOS/Material tab bars mark the current section — it can't spill into
 *      a neighbouring tab however long the label is.
 *   2. Marian blue on the label and icon. Same weight as the others on
 *      purpose: bold made "Conversación" too wide for its cell at 360px. Gold is reserved for Scripture;
 *      anything you can touch is blue.
 *   3. A filled icon variant — inactive icons are stroke-only, active ones are
 *      filled, so a glance tells you where you are without reading labels.

 */
type Item = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const items: Item[] = [
  { href: "/", label: "Inicio", icon: (a) => <HomeIcon active={a} /> },
  { href: "/chat", label: "Conversación", icon: (a) => <ChatIcon active={a} /> },
  { href: "/favoritas", label: "Favoritas", icon: (a) => <HeartIcon active={a} /> },
  { href: "/oracion", label: "Oración", icon: (a) => <MicIcon active={a} /> },
  { href: "/misas", label: "Parroquias", icon: (a) => <ChurchIcon active={a} /> },
];

/**
 * Space a page must reserve for the nav: the measured height BottomNav
 * publishes as --nav-h (it grows with Ajustes → Tamaño del texto), with the
 * 100%-size formula as the first-paint fallback (1px border + 6px top pad +
 * 52px items + max(0.5rem, safe-area) bottom pad).
 */
export const NAV_H = "var(--nav-h, calc(59px + max(0.5rem, env(safe-area-inset-bottom))))";

export function BottomNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // Publish the nav's real height as --nav-h on <html>. It's not a constant:
  // the labels are in rem, so Ajustes → Tamaño del texto makes the nav
  // taller. Pages reserve space with var(--nav-h, <fallback>) instead of
  // hardcoding 58/59px, which left the chat input under the nav at 130%.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() =>
      root.style.setProperty("--nav-h", `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--nav-h");
    };
  }, [pathname]);

  const activeIndex = items.findIndex((item) => isActive(pathname, item.href));

  // Centre the capsule on the active tab by measuring it, not by assuming
  // equal 1/5 cells: with large text (Ajustes) "Conversación" can't shrink
  // to a fifth, the cells become unequal and a %-based position drifted
  // ~27px off its icon. Written straight to the element — no re-render.
  const listRef = useRef<HTMLUListElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const cap = capRef.current;
    if (!list || !cap || activeIndex < 0) return;
    const place = () => {
      const tab = list.children[activeIndex] as HTMLElement | undefined;
      if (!tab) return;
      cap.style.left = `${tab.offsetLeft + tab.offsetWidth / 2 - cap.offsetWidth / 2}px`;
      cap.style.opacity = "1";
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeIndex]);

  if (pathname?.startsWith("/auth")) return null;

  return (
    <>
    <DesktopNav activeIndex={activeIndex} />
    {/* The fixed wrapper is what gets measured for --nav-h. Hidden from lg
        up (the sidebar takes over), which measures 0 — so pages stop
        reserving bottom space on desktop automatically. */}
    <div
      ref={navRef}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--paper)] border-t border-[var(--rule)] no-print"
    >
      <nav aria-label="Navegación principal">
      <div className="max-w-2xl mx-auto px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="relative">
          {activeIndex >= 0 && (
            // Icon-sized capsule (56×30), centred on the active tab's icon.
            // It used to fill the whole tab cell; with five tabs a cell is
            // ~75px and "Conversación" is ~69px, so the box touched the
            // neighbouring labels and looked like it spilled into the next
            // tab. Placed by measuring the active tab (effect above).
            <span
              ref={capRef}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-1.5 h-[30px] w-[56px] rounded-full",
                "transition-opacity duration-200",
                "motion-reduce:transition-none",
              )}
              style={{
                left: 0,
                opacity: 0,
                backgroundColor: "color-mix(in srgb, var(--marian) 14%, transparent)",
                boxShadow:
                  "inset 0 0 0 1px color-mix(in srgb, var(--marian) 24%, transparent)",
              }}
            />
          )}
          <ul ref={listRef} className="relative flex items-stretch">
            {items.map((item, i) => {
              const active = i === activeIndex;
              return (
                <li key={item.href} className="flex-1 min-w-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    style={{ touchAction: "manipulation" }}
                    className={cn(
                      "flex flex-col items-center gap-1 px-0 pt-1.5 pb-1 rounded-2xl min-h-[52px] active:scale-95",
                      "transition-colors duration-200 ease-out",
                      active
                        ? "text-[var(--marian)]"
                        : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)]",
                    )}
                  >
                    <span aria-hidden="true" className="grid place-items-center h-[30px] w-[56px]">
                      {item.icon(active)}
                    </span>
                    <span
                      className={cn(
                        // Capped: Ajustes → Tamaño del texto is for reading. At 130%
                        // five labels no longer fit and "Parroquias" ran off-screen.
                        "max-w-full truncate font-sans text-[min(0.68rem,11px)] tracking-[-0.02em]",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      </nav>
    </div>
    </>
  );
}

/**
 * Desktop (lg+) navigation: a fixed left sidebar instead of the phone tab
 * bar, which on a wide screen sat lost at the bottom with tiny icons. The
 * page content shifts right via `body:has(.desktop-nav)` in globals.css.
 */
function DesktopNav({ activeIndex }: { activeIndex: number }) {
  return (
    <aside className="desktop-nav hidden lg:flex fixed inset-y-0 left-0 z-40 w-[240px] flex-col border-r border-[var(--rule)] bg-[var(--paper)] no-print">
      <Link href="/" className="flex items-center gap-3 px-6 pt-7 pb-8 group">
        <LatinCross className="text-[var(--gold)] shrink-0 transition-opacity group-hover:opacity-80" size={18} />
        <span className="font-display text-[17px] leading-tight whitespace-nowrap text-[var(--ink)]">Habla con la Palabra</span>
      </Link>
      <nav aria-label="Navegación principal" className="px-3">
        <ul className="space-y-1">
          {items.map((item, i) => {
            const active = i === activeIndex;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 min-h-[46px] px-4 rounded-xl font-sans text-[15px] transition-colors",
                    active
                      ? "text-[var(--marian)] font-semibold bg-[color-mix(in_srgb,var(--marian)_11%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--marian)_20%,transparent)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--vellum)]",
                  )}
                >
                  <span aria-hidden="true" className="grid place-items-center w-6">{item.icon(active)}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Each icon: stroke-only when inactive, gently filled when active. The
 *  fill uses currentColor at low opacity so it picks up the marian accent
 *  of the active state without us having to hardcode a hex. */
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.16 : 0}
      />
    </svg>
  );
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.16 : 0}
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
        fillOpacity={active ? 0.16 : 0}
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
        fillOpacity={active ? 0.16 : 0}
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
        fillOpacity={active ? 0.16 : 0}
      />
      <line x1="3" y1="21" x2="21" y2="21" />
      <rect x="10" y="14" width="4" height="7" />
    </svg>
  );
}
