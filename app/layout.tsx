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
// and double-tap-to-zoom are disabled. (Note: this trades off WCAG 2.1's
// recommendation to leave zoom available for low-vision users; if we want
// to soften this later we can drop maximumScale and userScalable.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)",  color: "#0F1525" },
  ],
};

/**
 * Synchronously sets `data-theme` on <html> from localStorage or system
 * preference, BEFORE React hydrates, so the user never sees a flash from
 * light → dark on page load. We also decide whether the daily-verse
 * overlay should be visible by reading sessionStorage. CSS hides the
 * overlay if `data-daily-verse-seen='1'` is set, so users who already
 * saw today's verse never see a flash of the home page underneath
 * before React mounts the overlay.
 */
const initScript = `
(function() {
  // Theme — always start in light. The user asked that the app not persist
  // a theme choice across reloads. The toggle still works within a session
  // but every fresh load begins in light mode. Setting data-theme
  // explicitly also prevents the @media (prefers-color-scheme: dark)
  // fallback from briefly applying dark.
  document.documentElement.setAttribute('data-theme', 'light');
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
