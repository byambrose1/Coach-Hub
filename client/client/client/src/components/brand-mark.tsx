// The Practably mark: a custom open-bowl "P" with an orange terminal dot.
// Rendered inline (not as an <img>) so it stays crisp at any size. Kept as
// its own component so the sidebar, landing page, and public pages all use
// the exact same mark. Use variant="inverted" on dark backgrounds (e.g. the
// footer) - the plain violet stroke reads muddy against near-black.
export function BrandMark({
  className = "h-8 w-8",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "inverted";
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M30,86 L30,14 L58,14 C76,14 87,25 87,41 C87,55 78,64 63,66"
        fill="none"
        stroke={variant === "inverted" ? "#ffffff" : "#4c1d95"}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="63" cy="66" r="10" fill="#f97316" />
    </svg>
  );
}
