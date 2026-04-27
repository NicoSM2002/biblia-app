# Habla con la Palabra

Una app web católica para conversar con la Sagrada Escritura. Cualquier persona puede preguntar lo que lleva dentro y la app responde con un versículo bíblico (cita textual) seguido de una explicación pastoral cercana.

- **Biblia:** Sagrada Biblia, Versión Oficial de la Conferencia Episcopal Española (BAC, 2011) — 73 libros, 34,623 versículos extraídos.
- **IA:** Claude (Anthropic) — versículo elegido validado contra el texto literal antes de mostrarse.
- **Búsqueda:** vectorial vía Voyage AI si hay API key, BM25 keyword search como fallback.
- **Sin cuentas, sin historial persistente:** cada visita es un encuentro nuevo.

---

## Getting started

1. Copia las variables de entorno:

   ```bash
   cp .env.local.example .env.local
   ```

2. Edita `.env.local` y añade al menos `ANTHROPIC_API_KEY` (obligatorio). Si tienes `VOYAGE_API_KEY` la calidad de búsqueda mejora notablemente.

3. (Opcional, recomendado) Genera los embeddings — una sola vez:

   ```bash
   # 1. Genera embeddings float32 (~150 MB, sólo desarrollo local)
   npx tsx scripts/build_embeddings.ts

   # 2. Cuantiza a int8 (~36 MB, lo que se sube a Vercel)
   npx tsx scripts/quantize_embeddings.ts
   ```

   Output:
   - `data/biblia.embeddings.json` — versión float32 completa (no commitear)
   - `data/biblia.embeddings.bin` + `.meta.json` — cuantizado int8 (commitear)

   El runtime auto-detecta cuál usar: prefiere el `.bin` si existe.

4. Arranca el dev server:

   ```bash
   npm run dev
   ```

   Abre http://localhost:3000

---

## Estructura

```
biblia-app/
├── app/
│   ├── page.tsx              ← chat principal (client component)
│   ├── api/chat/route.ts     ← streaming endpoint
│   ├── layout.tsx            ← fonts, metadata
│   └── globals.css           ← paleta + tipografía + animaciones
├── components/
│   ├── Header.tsx
│   ├── Cross.tsx             ← cruz latina custom
│   ├── VerseCard.tsx         ← cartouche del versículo
│   ├── ResponseText.tsx      ← respuesta pastoral
│   ├── QuestionLine.tsx      ← pregunta del usuario
│   ├── Loading.tsx           ← "Buscando en la Palabra…"
│   └── ChatInput.tsx
├── lib/
│   ├── bible.ts              ← carga + búsqueda BM25/vectorial
│   ├── claude.ts             ← cliente Claude + system prompt católico
│   ├── validate.ts           ← validación literal del versículo citado
│   └── utils.ts              ← cn() helper
├── data/
│   ├── biblia.json           ← 34,623 versículos estructurados
│   ├── biblia-raw.txt        ← texto plano del PDF
│   └── biblia.embeddings.json (generado opcionalmente)
├── scripts/
│   ├── extract_bible.py      ← PDF → biblia.json
│   ├── build_embeddings.ts   ← biblia.json → biblia.embeddings.json
│   └── test_search.ts        ← sanity check de búsqueda BM25
└── Contexto/
    └── Biblia.pdf            ← fuente original
```

---

## Cómo funciona el pipeline anti-alucinación

1. El usuario envía su pregunta + el historial corto de la conversación.
2. Se buscan los **8 versículos más relevantes** (vectorial si hay embeddings, sino BM25).
3. Esos versículos se pasan a Claude como contexto, junto con un system prompt católico estricto que le pide:
   - Elegir UN versículo y citarlo TEXTUALMENTE.
   - Responder en JSON `{verse: {reference, text}, response}`.
   - Tono pastoral, católico, cercano.
4. Mientras Claude responde, el backend **parsea el JSON parcialmente** y emite eventos SSE (`verse`, `response_delta`, `result`) — el frontend muestra el versículo y luego va escribiendo la respuesta.
5. Antes de mostrar la cita, `lib/validate.ts` **verifica que el versículo existe literal** en `biblia.json`. Si no coincide, se descarta y se muestra solo la respuesta sin cita falsa.

---

## Deploy a Vercel

```bash
npm i -g vercel
vercel
```

Configura las variables de entorno en el dashboard de Vercel:

- `ANTHROPIC_API_KEY` (requerido)
- `VOYAGE_API_KEY` (recomendado)

`next.config.ts` ya incluye `outputFileTracingIncludes` para bundlear los archivos `data/`. El primer arranque puede ser lento mientras carga los embeddings en memoria; luego es muy rápido.

---

## Identidad visual

**Aesthetic concept:** *Lectio in silentio* — el misal contemporáneo. Cada pregunta es una página de un breviario digital.

- Paleta: `#FAF7F2` (blanco hueso), `#B8924A` (dorado mate), `#1B3A6B` (azul mariano), `#1F1B16` (gris carbón).
- Tipografía: **EB Garamond** (versículos, en cursiva, drop cap dorado) + **Inter** (respuesta pastoral, cuerpo).
- Detalles: ruido de papel sutil, líneas verticales doradas tipo borde de misal, mayúsculas en small-caps con tracking ancho para las rúbricas.
- Sin candelabros, sin lunas, sin gradientes místicos. Es una capilla en silencio.

---

## Atribución

Sagrada Biblia. Versión oficial de la Conferencia Episcopal Española.
© Conferencia Episcopal Española, 2011. © Biblioteca de Autores Cristianos.

Esta es una app de uso personal/educativo. Para uso comercial, contactar con la BAC y la Conferencia Episcopal.
