/**
 * Claude client for "Habla con la Palabra".
 *
 * No longer the default path — see lib/llm.ts. Kept fully working so
 * LLM_PROVIDER=claude rolls the app back to it without a code change, because
 * the tone of the responses is the entire product and a provider swap is the
 * kind of thing you want to be able to undo in a redeploy.
 *
 * The system prompt and context builders live in lib/prompt.ts and are shared
 * with the DeepSeek path, so both providers receive byte-identical instructions.
 *
 * Uses prompt caching on the system prompt and the verse context, so repeated
 * queries with the same candidate set are cheap.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PastoralArgs, TextStream } from "./llm";
import {
  SYSTEM_PROMPT,
  buildCredoContext,
  buildVersesContext,
} from "./prompt";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function streamPastoral(args: PastoralArgs): Promise<TextStream> {
  const { question, history, retrieved, credo = [] } = args;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY no está configurada en este servidor.");
  }

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
    ...history.map(
      (m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam,
    ),
    { role: "user", content: userContent },
  ];

  const stream = getClient().messages.stream({
    model: MODEL,
    // Generous ceiling — emotional or doctrinal answers can run long, and
    // truncation mid-JSON used to cause the "moment of silence" fallback.
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  return (async function* () {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  })();
}
