/**
 * The pastoral response — Inter (sans), normal weight, comfortable line-height.
 * Now wrapped in a clean white card so it sits clearly below the verse instead
 * of floating in the page.
 */
export function ResponseText({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  return (
    <div className="anim-fade-in mb-4" style={{ animationDelay: "120ms" }}>
      <span className="label-section">Respuesta</span>
      <div className="card-response">
        <p
          className="font-sans text-[0.98rem] sm:text-[1.02rem] leading-[1.7] text-[var(--ink)]"
          style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
        >
          {text}
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
