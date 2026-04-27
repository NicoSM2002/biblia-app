/**
 * POST /api/chat — receives the user's question and conversation history,
 * retrieves relevant verses, asks Claude for a pastoral response, validates
 * the quoted verse against the literal Bible text, and streams the result.
 *
 * Request body:
 *   {
 *     "question": "...",
 *     "history": [{ "role": "user" | "assistant", "content": "..." }, ...]
 *   }
 *
 * Response: Server-Sent Events stream with two event types:
 *   - "delta": partial text from Claude (raw JSON-fragment)
 *   - "result": final parsed { verse: {reference, text}, response } (validated)
 *   - "error": { message }
 */

import { NextRequest } from "next/server";
import { search } from "@/lib/bible";
import { streamPastoralResponse, type ChatMessage } from "@/lib/claude";
import { validateQuote } from "@/lib/validate";

export const runtime = "nodejs"; // need fs access for the bible JSON
export const dynamic = "force-dynamic";

type Body = {
  question: string;
  history?: ChatMessage[];
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
    });
  }
  const question = (body.question || "").trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "question is required" }), {
      status: 400,
    });
  }
  const history = (body.history || []).slice(-10); // cap context

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      try {
        // Compose query from current question + recent user messages for better
        // multi-turn retrieval
        const expandedQuery = [
          ...history
            .filter((m) => m.role === "user")
            .slice(-2)
            .map((m) => m.content),
          question,
        ].join(" ");
        const retrieved = await search(expandedQuery, 8);
        if (retrieved.length === 0) {
          send("result", {
            verse: null,
            response:
              "No encontré un versículo que se acerque a lo que me preguntas. ¿Puedes contarme un poco más, con tus palabras?",
          });
          controller.close();
          return;
        }

        const claudeStream = await streamPastoralResponse({
          question,
          history,
          retrieved,
        });

        let accumulated = "";
        let lastEmittedVerse: { reference: string; text: string } | null = null;
        let lastEmittedResponse = "";

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            accumulated += event.delta.text;
            // Try to extract verse + response progressively from the partial JSON.
            const partial = extractPartialFields(accumulated);
            if (
              partial.verse &&
              (!lastEmittedVerse ||
                lastEmittedVerse.reference !== partial.verse.reference ||
                lastEmittedVerse.text !== partial.verse.text)
            ) {
              lastEmittedVerse = partial.verse;
              send("verse", partial.verse);
            }
            if (partial.response && partial.response !== lastEmittedResponse) {
              const delta = partial.response.slice(lastEmittedResponse.length);
              lastEmittedResponse = partial.response;
              if (delta) send("response_delta", { text: delta });
            }
          }
        }

        // Parse the final JSON
        const parsed = parseResponseJSON(accumulated);
        if (!parsed) {
          send("result", {
            verse: null,
            response:
              "Disculpa, hubo un momento de silencio. ¿Quieres preguntarme de nuevo?",
          });
          controller.close();
          return;
        }

        // Validate the quoted verse if one was provided
        if (parsed.verse) {
          const v = validateQuote(parsed.verse.reference, parsed.verse.text);
          if (!v.ok) {
            // Verse failed validation — return Claude's response without a verse
            // rather than risk citing something fabricated.
            send("result", {
              verse: null,
              response: parsed.response,
              warning: `verse validation failed: ${v.reason}`,
            });
            controller.close();
            return;
          }
          send("result", {
            verse: { reference: v.reference, text: v.text },
            response: parsed.response,
          });
        } else {
          send("result", {
            verse: null,
            response: parsed.response,
          });
        }
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Best-effort extraction of `verse` and `response` from a partial JSON string.
 * Used during streaming so the frontend can render the verse and animate the
 * response as it arrives.
 */
function extractPartialFields(raw: string): {
  verse: { reference: string; text: string } | null;
  response: string;
} {
  const refMatch = raw.match(/"reference"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const textMatch = raw.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  let verse: { reference: string; text: string } | null = null;
  if (refMatch && textMatch) {
    verse = {
      reference: unescapeJsonString(refMatch[1]),
      text: unescapeJsonString(textMatch[1]),
    };
  }
  // Response may be incomplete (no closing quote yet); match either a closed
  // string ("response": "...") or an open one (still being streamed).
  const closed = raw.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const open = raw.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)$/);
  let response = "";
  if (closed) response = unescapeJsonString(closed[1]);
  else if (open) response = unescapeJsonString(open[1]);
  return { verse, response };
}

function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseResponseJSON(raw: string): {
  verse: { reference: string; text: string } | null;
  response: string;
} | null {
  // Be lenient: model might wrap JSON in code fences or include leading prose.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof obj.response !== "string") return null;
    if (obj.verse && typeof obj.verse === "object") {
      if (typeof obj.verse.reference !== "string" || typeof obj.verse.text !== "string") {
        return { verse: null, response: obj.response };
      }
    }
    return obj;
  } catch {
    return null;
  }
}
