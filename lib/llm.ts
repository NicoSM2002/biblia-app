/**
 * Provider switch for the pastoral response.
 *
 * Both clients expose the same shape — an async iterable of plain text deltas —
 * so the chat route never knows which vendor is behind it. Streaming event
 * shapes differ wildly between providers (Anthropic emits typed
 * `content_block_delta` events, OpenAI-compatible APIs emit
 * `choices[0].delta.content`), and normalising here is what keeps that
 * difference out of the route.
 *
 * Pick with LLM_PROVIDER:
 *
 *   deepseek  (default) — deepseek-v4-flash. ~54x cheaper on output tokens
 *                         than Sonnet 4.6 and noticeably faster.
 *   claude              — the original. One env var away, because the whole
 *                         product of this app is its tone: if DeepSeek ever
 *                         reads wrong in Spanish or drifts on the Catholic
 *                         framing, rolling back is a redeploy, not a rewrite.
 */

import type { Retrieved } from "./bible";
import type { CredoQA } from "./credo";
import type { ChatMessage } from "./prompt";
import { streamPastoral as streamClaude } from "./claude";
import { streamPastoral as streamDeepSeek } from "./deepseek";

export type { ChatMessage } from "./prompt";

export type PastoralArgs = {
  question: string;
  history: ChatMessage[];
  retrieved: Retrieved[];
  credo?: { qa: CredoQA }[];
};

/** An async iterable of plain text deltas. Nothing vendor-shaped escapes here. */
export type TextStream = AsyncIterable<string>;

export type Provider = "claude" | "deepseek";

/**
 * DeepSeek when it can actually answer, Claude otherwise.
 *
 * The fallback is deliberate: without it, deploying this change would take the
 * app down the moment it shipped and stay down until DEEPSEEK_API_KEY reached
 * the host's environment. A missing key is a configuration gap, not a reason to
 * hand every user "hubo un momento de silencio".
 *
 * LLM_PROVIDER overrides the choice in both directions — set it to "claude" to
 * roll back with a key present, or to "deepseek" to make a missing key a loud
 * failure instead of a silent fallback (useful in staging, where you want to
 * know the key is wrong rather than quietly pay Anthropic rates).
 */
export function activeProvider(): Provider {
  const forced = process.env.LLM_PROVIDER;
  if (forced === "claude" || forced === "deepseek") return forced;
  return process.env.DEEPSEEK_API_KEY ? "deepseek" : "claude";
}

export function streamPastoralResponse(args: PastoralArgs): Promise<TextStream> {
  return activeProvider() === "claude"
    ? streamClaude(args)
    : streamDeepSeek(args);
}
