/**
 * Loading indicator — three dots in dorado plus a clear label.
 */
export function Loading() {
  return (
    <div
      className="anim-fade-in flex items-center gap-3 my-4 px-1"
      role="status"
      aria-label="Buscando en la Palabra"
    >
      <span className="flex items-center gap-[5px]">
        <span className="dot-1 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
        <span className="dot-2 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
        <span className="dot-3 inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" />
      </span>
      <span className="font-sans text-[0.84rem] text-[var(--ink-faint)]">
        Buscando en la Palabra…
      </span>
    </div>
  );
}
