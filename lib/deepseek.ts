/**
 * DeepSeek client for "Habla con la Palabra".
 *
 * The DeepSeek API is OpenAI-compatible, so we drive it with the `openai`
 * package pointed at https://api.deepseek.com. The system prompt and context
 * builders are shared with the Claude path (lib/prompt.ts) — the model changes,
 * the voice does not.
 *
 * Two differences from the Anthropic client worth knowing:
 *
 * 1. Prompt caching is AUTOMATIC. There is no `cache_control` to place —
 *    DeepSeek caches on the request prefix and bills hits at $0.0028/M instead
 *    of $0.14/M. That's why the system prompt is messages[0] and the volatile
 *    parts (history, verses, question) come after it: the ~2.5k-token prompt is
 *    then byte-identical on every request from every user and always hits.
 *
 * 2. No JSON mode. DeepSeek offers `response_format: {type: "json_object"}`,
 *    but its own docs warn the API "may occasionally return empty content" in
 *    that mode. An empty response here means the user sees the "momento de
 *    silencio" fallback instead of an answer, which is a worse failure than the
 *    stray code fence that mode would prevent — and parseResponseJSON in the
 *    chat route already strips fences and slices from the first `{` to the last
 *    `}`. If DeepSeek fixes that caveat, turning the mode on is one line.
 *
 * 3. Thinking is OFF. This one is not a preference — leaving DeepSeek's
 *    default in place broke the app in production, measurably:
 *
 *      - Thinking is enabled by default at "high" effort on both v4 models.
 *      - The chain of thought streams on `reasoning_content`, a sibling of
 *        `content`. A client that reads only `content` therefore emits nothing
 *        at all while the model thinks: measured median time-to-first-token was
 *        ~16s of dead air, then the whole answer at once in under a second.
 *        The per-word reveal and the candle this app is built around never got
 *        a chance to do anything.
 *      - Reasoning tokens are drawn from the same max_tokens budget as the
 *        answer. At high effort they routinely ate all 1500, so `content` came
 *        back empty or truncated and parseResponseJSON returned null —
 *        3 of 10 production requests fell through to "hubo un momento de
 *        silencio".
 *
 *    This app does not want a chain of thought. It wants one short pastoral
 *    paragraph in a fixed JSON envelope, and the system prompt already does
 *    the reasoning work. `thinking: {type: "disabled"}` is DeepSeek's
 *    documented off switch for the OpenAI-compatible format; it isn't in the
 *    OpenAI type surface, hence the spread below.
 */

import OpenAI from "openai";
import type { PastoralArgs, TextStream } from "./llm";
import {
  SYSTEM_PROMPT,
  buildCredoContext,
  buildVersesContext,
} from "./prompt";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return client;
}

export async function streamPastoral(args: PastoralArgs): Promise<TextStream> {
  const { question, history, retrieved, credo = [] } = args;

  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      "DEEPSEEK_API_KEY no está configurada en este servidor.",
    );
  }

  const parts = [
    `VERSÍCULOS DISPONIBLES (elige UNO y cítalo textualmente):\n\n${buildVersesContext(retrieved)}`,
  ];
  if (credo.length > 0) {
    parts.push(
      `DOCTRINA COMPLEMENTARIA (úsala SOLO si aporta y NO la cites ni la nombres):\n\n${buildCredoContext(credo)}`,
    );
  }
  parts.push(`PREGUNTA: ${question}`);

  const stream = await getClient().chat.completions.create({
    model: MODEL,
    // Generous ceiling — emotional or doctrinal answers can run long, and
    // truncation mid-JSON causes the "moment of silence" fallback.
    max_tokens: 1500,
    stream: true,
    messages: [
      // Constant across every request — this is the cached prefix.
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content }) as const),
      { role: "user", content: parts.join("\n\n") },
    ],
    // DeepSeek-only parameter (see note 3 above). Spread rather than written
    // inline because it isn't part of the OpenAI request type; the SDK
    // forwards unknown body keys as-is.
    ...({ thinking: { type: "disabled" } } as Record<string, unknown>),
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  })();
}
