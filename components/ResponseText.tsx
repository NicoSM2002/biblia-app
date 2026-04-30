/**
 * The pastoral response — labeled "REFLEXIÓN" above a clean white card.
 *
 * Streaming behavior: instead of repainting the whole paragraph on every SSE
 * chunk (which feels brusque), we split the response into word-tokens and
 * render each as a <span key={i}>. React keeps existing spans mounted; only
 * the *new* words mount and fire their CSS fade-in. The result is a soft
 * typewriter where each word gently materializes.
 */
export function ResponseText({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  const tokens = text.match(/\S+\s*/g) ?? [];

  return (
    <div className="anim-fade-in mb-2" style={{ animationDelay: "120ms" }}>
      <span className="label-section">Reflexión</span>
      <div className="card-response">
        <p
          className="font-sans text-[0.98rem] sm:text-[1.02rem] leading-[1.7] text-[var(--ink)]"
          style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
        >
          {tokens.map((token, i) => (
            <span key={i} className="streaming-word">
              {token}
            </span>
          ))}
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
}
