import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

/**
 * Three faces, three jobs.
 *
 *   Fraunces        — display. Titles, the question on the home, the versal
 *                     drop caps. Variable old-style with SOFT/WONK axes; with
 *                     WONK=1 it gets the angled terminals that give it warmth
 *                     without reading as a period pastiche. Used sparingly
 *                     and large.
 *   Newsreader      — scripture and long-form. Drawn for screens (optical
 *                     size axis, generous x-height, solid stems at 20px),
 *                     which EB Garamond — a 16th-century print revival — is
 *                     not. Verses set ROMAN here, not italic: continuous
 *                     italic is slower to read and was never meant for
 *                     three-line blocks.
 *   Instrument Sans — UI chrome. Nav labels, metadata, form labels. Replaces
 *                     Inter, which is legible and says nothing.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
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
  themeColor: "#FAF6EE",
};

/**
 * Defensive cleanup — earlier builds of the app persisted the theme
 * choice in localStorage. Wipe that so a returning user from those
 * builds doesn't get dark-mode by accident.
 */
const initScript = `
(function() {
  try { localStorage.removeItem('theme'); } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${newsreader.variable} ${instrument.variable} h-full`}
      // data-theme="light" is hardcoded into the server-rendered HTML so
      // there's no dependency on the inline script firing before paint
      // and no risk of React removing the attribute during hydration. The
      // toggle button can flip this at runtime; reloads always come back
      // to light because every fresh response from the server has
      // data-theme="light" right here in the JSX.
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="relative min-h-full antialiased">
        {children}
      </body>
    </html>
  );
}
