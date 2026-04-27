/**
 * Custom Latin cross — drawn with serif feet, like a cross found on a missal
 * cover. Not a generic icon-pack cross.
 */
export function LatinCross({
  className = "",
  size = 14,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size * 1.45}
      viewBox="0 0 24 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
    >
      {/* vertical bar */}
      <line x1="12" y1="2" x2="12" y2="34" />
      {/* horizontal arm */}
      <line x1="3" y1="12" x2="21" y2="12" />
      {/* serif feet at the bottom (like Greek/Latin cross with calvary base) */}
      <line x1="9" y1="34" x2="15" y2="34" />
    </svg>
  );
}
