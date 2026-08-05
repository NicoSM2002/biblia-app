import { memo } from "react";

/**
 * The pastoral response.
 *
 * It used to be a white card under a "REFLEXIÓN" rubric. Between the question
 * bubble, the verse card and this one, every single turn was four stacked
 * rectangles — and the two rubrics repeated the same gold dash twice per turn
 * until it stopped carrying information.
 *
 * With the verse inside its window, the reflection doesn't need a container to
 * be told apart from it. Set in Newsreader directly on the paper, it reads
 * like a book instead of like a chat bubble — which is what this app is
 * actually for. This is also the longest text in the whole app and it was in
 * Inter.
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
    <div className="anim-fade-in mb-1 px-0.5" style={{ animationDelay: "120ms" }}>
      <p
        className="font-serif text-[1.02rem] sm:text-[1.06rem] leading-[1.62] text-[var(--ink)]"
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
