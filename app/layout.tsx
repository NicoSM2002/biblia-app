import type { Metadata, Viewport } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import { ViewTransitionLinks } from "@/components/ViewTransitionLinks";
import "./globals.css";

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Habla con la Palabra",
  description:
    "Pregúntale a la Sagrada Escritura. Una respuesta cercana, basada en la Biblia católica.",
  openGraph: {
    title: "Habla con la Palabra",
    description: "Pregúntale a la Sagrada Escritura.",
  },
};

// Zoom is intentionally locked at 1× per the user's request — pinch-to-zoom
// and double-tap-to-zoom are disabled. theme-color is hardcoded to paper
// (cream) instead of branching on prefers-color-scheme, because the user
// wants the app to ALWAYS look light on first paint, regardless of their
// OS dark setting. The mobile browser URL bar follows this color, so on
// an iPhone in dark mode the bar would otherwise turn dark — which the
// user perceived as "the app opened in dark mode" even though the page
// itself was light.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FAF7F2",
};

/**
 * Forces `data-theme="light"` on <html> before any paint. The user wants
 * the app to ALWAYS start in light mode, regardless of OS preference or
 * any previous toggle. The toggle button can swap to dark within a
 * session but reloads / new visits always come back to light.
 */
const initScript = `
(function() {
  document.documentElement.setAttribute('data-theme', 'light');
  // Defensive: also blow away any stale localStorage from earlier
  // versions of the app that used to persist the choice. Without this,
  // a user who toggled to dark in an old build would still see dark
  // after upgrading.
  try { localStorage.removeItem('theme'); } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${garamond.variable} ${inter.variable} h-full`}
      // The inline initScript below mutates <html> before React hydrates
      // (sets data-theme and data-daily-verse-seen). Without this, React
      // throws a hydration mismatch on every navigation and *throws away
      // the entire subtree to re-render from scratch* — which is exactly
      // what the user kept seeing as "elements refresh" and what was
      // masking the view-transition crossfade.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="relative min-h-full antialiased">
        <ViewTransitionLinks />
        {children}
      </body>
    </html>
  );
}
