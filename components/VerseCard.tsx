/**
 * The verse cartouche — a quoted scripture passage. Now wrapped in a clear
 * vellum card with a gold left border, with the reference shown ABOVE the
 * quote in small caps for instant scannability.
 */
export function VerseCard({
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

  return (
    <figure className="anim-fade-rise mb-4">
      <span className="label-section">La Palabra</span>
      <div className="card-verse">
        <cite className="not-italic block font-sans text-[0.78rem] tracking-[0.14em] uppercase text-[var(--gold)] mb-3">
          {reference}
        </cite>
        <blockquote
          cite={reference}
          className="font-serif italic text-[1.12rem] sm:text-[1.18rem] leading-[1.55] text-[var(--ink)]"
          style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
        >
          “{display}”
        </blockquote>
      </div>
    </figure>
  );
}
