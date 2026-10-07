import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { SETTINGS_INIT_SCRIPT } from "@/lib/settings";
import { SettingsSync } from "@/components/SettingsSync";
import { BottomNav } from "@/components/BottomNav";

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
  // Installed on iPhone ("Añadir a pantalla de inicio"): open full screen,
  // with this name under the icon. The icon itself is app/apple-icon.png;
  // the manifest (app/manifest.ts) covers Android and desktop.
  applicationName: "Habla con la Palabra",
  appleWebApp: {
    capable: true,
    title: "La Palabra",
    statusBarStyle: "default",
    // Launch screens for the installed app: without them iOS shows a black
    // screen until the first paint. Cream + the same cross as the in-app
    // splash (components/Splash.tsx), so launch → splash is seamless.
    // Generated per iPhone size into public/splash/.
    startupImage: [
      { url: "/splash/splash-1320x2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1206x2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/splash/splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
  },
  formatDetection: { telephone: false },
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
  // Lets the installed app draw under the iPhone notch/home bar; the pages
  // already pad with env(safe-area-inset-*), which is 0 without this.
  viewportFit: "cover",
  themeColor: "#FAF6EE",
};

/**
 * Defensive cleanup — earlier builds of the app persisted the theme
 * choice in localStorage. Wipe that so a returning user from those
 * builds doesn't get dark-mode by accident.
 *
 * Then apply the user's explicit Ajustes (lib/settings.ts) before first
 * paint. With nothing saved this is a no-op, so the default stays light.
 */
const initScript = `
(function() {
  try { localStorage.removeItem('theme'); } catch (e) {}
})();
${SETTINGS_INIT_SCRIPT}
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
        <SettingsSync />
        {/* Pages render inside .vt-page (named during page transitions);
            the nav lives OUTSIDE the pages so it is never torn down and
            rebuilt on navigation — that rebuild is what felt like a reload. */}
        <div className="vt-page">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
