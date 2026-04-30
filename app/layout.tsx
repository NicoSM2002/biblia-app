import type { Metadata, Viewport } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import { RouteTransition } from "@/components/RouteTransition";
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

// Allow user zoom (WCAG 2.1 — never block pinch-to-zoom; older / low-vision
// users need it). Just lock the initial scale so layout doesn't shift on
// page load. themeColor is set per-theme via the meta tag below in <head>.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)",  color: "#0F1525" },
  ],
};

/**
 * Synchronously sets `data-theme` on <html> from localStorage or system
 * preference, BEFORE React hydrates, so the user never sees a flash from
 * light → dark on page load.
 */
const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${garamond.variable} ${inter.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="relative min-h-full antialiased">
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
