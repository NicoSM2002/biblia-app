import { memo } from "react";

/**
 * The pastoral response — labeled "REFLEXIÓN" above a clean white card.
 *
 * Two render modes by status:
 *
 * - Streaming → split the response into word-tokens and render each as a
 *   <span key={i}>. React keeps existing spans mounted; only the *new*
 *   words mount and fire their CSS fade-in. Soft typewriter feel.
 *
 * - Done → render the response as a single text node, no spans. This
 *   matters for performance: a 200-word response renders as 200 DOM
 *   nodes during streaming; once done it collapses back to one. With
 *   50+ saved turns in a conversation, that's the difference between
 *   ~50 DOM nodes and 10,000+. The latter makes every textarea
 *   reflow (auto-grow) cost real milliseconds — the app starts feeling
 *   sluggish on long conversations. memo() also skips re-rendering for
 *   turns whose text didn't change.
 */
export const ResponseText = memo(function ResponseText({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  return (
    <div className="anim-fade-in mb-2" style={{ animationDelay: "120ms" }}>
      <span className="label-section">Reflexión</span>
      <div className="card-response">
        <p
          className="font-sans text-[0.98rem] sm:text-[1.02rem] leading-[1.7] text-[var(--ink)]"
          style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
        >
          {streaming ? <StreamingTokens text={text} /> : text}
          {streaming && (
            <span
              aria-hidden="true"
              className="ml-1 inline-block w-[2px] h-[1.05em] align-middle bg-[var(--gold)] dot-1"
            />
          )}
        </p>
      </div>
    </div>
  );
});

function StreamingTokens({ text }: { text: string }) {
  const tokens = text.match(/\S+\s*/g) ?? [];
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className="streaming-word">
          {token}
        </span>
      ))}
    </>
  );
}
