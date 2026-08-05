import { memo } from "react";

/**
 * The verse — now a window rather than a card.
 *
 * It used to be a vellum rectangle with a gold left border and a "LA PALABRA"
 * rubric above it, which made it the second of four stacked rectangles in
 * every turn. As an arched panel with an illuminated initial it becomes the
 * only object in the turn, and the rubric is no longer explaining anything the
 * shape doesn't already say.
 *
 * The text is set ROMAN, not italic. Continuous italic is slower to read and
 * was never meant for three-line blocks — that, plus EB Garamond's hairline
 * stems, was why the verse was hard to read. It was never a contrast problem.
 *
 * memo()'d so previous turns' verses don't re-render every time the chat state
 * changes — important when the conversation gets long.
 */
export const VerseCard = memo(function VerseCard({
  reference,
  text,
}: {
  reference: string;
  text: string;
}) {
  // Strip BAC artefacts: poetic line separator "|" and Hebrew acrostic letter
  // marks like "(Pe)" / "(Alef)".
  const ACROSTIC =
    /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;
  const display = text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim();

  const { initial, rest } = splitVersal(display);

  return (
    <figure className="anim-fade-rise mb-5 mt-1">
      <div className="arch-panel arch-panel-sm">
        <div className="arch-body">
          {initial && (
            <span aria-hidden="true" className="versal versal-sm">
              {initial}
            </span>
          )}
          <blockquote
            cite={reference}
            className="font-serif text-[1.1rem] sm:text-[1.15rem] leading-[1.5] text-[var(--ink)]"
            style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
          >
            {/* The initial is rendered twice: once as the decorative versal
                (aria-hidden) and once inside an sr-only span, so the verse is
                still read as one whole sentence by a screen reader. */}
            <span className="sr-only">{initial}</span>
            {rest}
          </blockquote>
          <figcaption className="ref-rule">{formatReference(reference)}</figcaption>
        </div>
      </div>
    </figure>
  );
});

/**
 * Peel the first character off for the drop cap. Falls back to no versal if
 * the verse opens with something that isn't a letter (a numeral, an ellipsis),
 * where a 3.6rem initial would look like a mistake rather than an ornament.
 */
export function splitVersal(text: string): { initial: string; rest: string } {
  const first = text.charAt(0);
  if (!first || !/\p{L}/u.test(first)) return { initial: "", rest: text };
  return { initial: first, rest: text.slice(1) };
}

/** "Salmo 34:18" → "Salmo 34 · 18" — the colon reads as data, the middot as
 *  a citation. Left alone if the reference isn't in chapter:verse form. */
export function formatReference(reference: string): string {
  return reference.replace(/(\d)\s*:\s*(\d)/, "$1 · $2");
}
