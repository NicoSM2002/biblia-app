import type { MetadataRoute } from "next";

/**
 * Web app manifest — what makes "Añadir a pantalla de inicio" / "Instalar"
 * produce a real app: name, icon, opens full-screen (no browser bars), with
 * the cream splash. Icons are generated from one design (arch window + gold
 * cross, the same mark as the sign-in screen); the maskable one keeps the
 * mark inside Android's safe zone so circular crops don't cut it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habla con la Palabra",
    short_name: "La Palabra",
    description: "Pregúntale a la Sagrada Escritura. Respuestas basadas en la Biblia y la fe católica.",
    lang: "es",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF6EE",
    theme_color: "#FAF6EE",
    categories: ["books", "lifestyle", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
