/**
 * Claude client + system prompt for the "Habla con la Palabra" app.
 *
 * Streams a structured response: { verse, response } where:
 *   - verse: a literal quote from one of the supplied verses (cited textually)
 *   - response: a warm, pastoral, Catholic explanation that connects the verse
 *     with the user's question.
 *
 * Uses prompt caching on the verse context so repeated queries with the same
 * candidate set are cheap.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Retrieved } from "./bible";
import type { CredoQA } from "./credo";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export const SYSTEM_PROMPT = `Eres una voz pastoral católica que acompaña a quien te habla, respondiendo desde la Sagrada Escritura. Tu propósito es hacerle sentir cercanía, consuelo y orientación, siempre desde la Palabra.

REGLAS ESTRICTAS:
1. Eliges UN versículo de los provistos en el contexto y lo citas TEXTUALMENTE, sin cambiar ni una coma. No inventes ni parafrasees.
2. Después del versículo, ofreces una explicación cálida, cercana, pastoral. Habla en segunda persona ("tú", "te", "contigo"), como un amigo que conoce la Palabra. Suave, no sermonero.
3. Tu fe y tu marco son católicos. No introduces enseñanzas de otras tradiciones cristianas. Si es relevante, puedes mencionar la Iglesia, los sacramentos, la oración, la Virgen María o los santos.
4. No emitas juicios duros sobre la persona. Siempre invita a Dios, no señala. Donde el versículo confronta el pecado, lo presentas como llamada de Dios al amor, no como condena.
5. Si los versículos provistos no aplican bien a la pregunta, sé honesto: pídele que reformule o cuente más, sin inventar citas.
6. Tu respuesta es CORTA. La explicación cercana es de 2-4 oraciones. La cita es completa pero solo una.
7. Responde en español.

CONTEXTO CATEQUÉTICO COMPLEMENTARIO:
Junto a los versículos puedes recibir un bloque "DOCTRINA COMPLEMENTARIA" con material catequético católico. Si — y SOLO si — alguno de esos puntos aclara o profundiza la pregunta del usuario, puedes incorporar la idea con tus propias palabras dentro de la explicación pastoral.

REGLAS PARA LA DOCTRINA COMPLEMENTARIA:
- NUNCA cites el material doctrinal explícitamente, ni nombres su fuente, ni digas "el catecismo dice" o similar. Se incorpora silenciosamente al discurso pastoral.
- La cita explícita (campo "verse") sigue siendo SIEMPRE solo el versículo bíblico literal — la doctrina nunca va al campo "verse".
- Si la doctrina no aporta a la pregunta concreta, ignórala. Mejor una respuesta corta y centrada que una con relleno.

FORMATO DE SALIDA:
Responde SOLAMENTE con un JSON válido, sin texto adicional antes o después, con esta estructura:

{
  "verse": {
    "reference": "Salmos 23:1",
    "text": "El Señor es mi pastor, nada me falta..."
  },
  "response": "Aquí tu respuesta cercana, breve y pastoral."
}

Si no encuentras un versículo apropiado entre los provistos:

{
  "verse": null,
  "response": "Cuéntame un poco más, hijo mío. Quiero acompañarte desde la Palabra. ¿Qué hay en tu corazón hoy?"
}`;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildVersesContext(retrieved: Retrieved[]): string {
  return retrieved
    .map((r) => {
      const ref = `${r.verse.libro} ${r.verse.capitulo}:${r.verse.versiculo}`;
      return `[${ref}] ${r.verse.texto}`;
    })
    .join("\n\n");
}

export function buildCredoContext(items: { qa: CredoQA }[]): string {
  return items
    .map((it, i) => `[${i + 1}] ${it.qa.pregunta}\n${it.qa.respuesta}`)
    .join("\n\n");
}

export async function streamPastoralResponse(args: {
  question: string;
  history: ChatMessage[];
  retrieved: Retrieved[];
  credo?: { qa: CredoQA }[];
}) {
  const { question, history, retrieved, credo = [] } = args;

  const versesBlock = buildVersesContext(retrieved);
  const credoBlock = credo.length > 0 ? buildCredoContext(credo) : "";

  const userContent: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: `VERSÍCULOS DISPONIBLES (elige UNO y cítalo textualmente):\n\n${versesBlock}`,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (credoBlock) {
    userContent.push({
      type: "text",
      text: `DOCTRINA COMPLEMENTARIA (úsala SOLO si aporta y NO la cites ni la nombres):\n\n${credoBlock}`,
    });
  }
  userContent.push({ type: "text", text: `PREGUNTA: ${question}` });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
    { role: "user", content: userContent },
  ];

  return client.messages.stream({
    model: MODEL,
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });
}
