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
      className={`${garamond.variable} ${inter.variable} h-full`}
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
        <ViewTransitionLinks />
        {children}
      </body>
    </html>
  );
}
