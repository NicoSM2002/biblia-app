/**
 * Waiting state — a candle instead of three pulsing dots.
 *
 * Same job, same footprint, but it belongs to the world of the app: three
 * dots are what every loading state on the internet looks like. The flame's
 * flicker is deliberately uneven, because an even pulse reads as a spinner.
 */
export function Loading() {
  return (
    <div
      className="anim-fade-in flex items-center gap-3 my-4 px-1"
      role="status"
      aria-label="Buscando en la Palabra"
    >
      <Flame />
      <span className="font-serif italic text-[0.96rem] text-[var(--ink-soft)]">
        Buscando en la Palabra…
      </span>
    </div>
  );
}

function Flame() {
  return (
    <svg
      className="flame shrink-0"
      width="18"
      height="26"
      viewBox="0 0 24 34"
      aria-hidden="true"
    >
      {/* Sharp tip, wide belly, teardrop base — a rounded top reads as a
          water drop, which is the one thing this must not look like. */}
      <path
        d="M12 1s7.2 8.4 7.2 15.6c0 4.9-3.2 8.6-7.2 8.6s-7.2-3.7-7.2-8.6C4.8 9.4 12 1 12 1z"
        fill="var(--gold)"
      />
      <path
        d="M12 12s3.1 3.9 3.1 7.2c0 2.3-1.4 4-3.1 4s-3.1-1.7-3.1-4C8.9 15.9 12 12 12 12z"
        fill="#FDF0C8"
        fillOpacity="0.92"
      />
    </svg>
  );
}
