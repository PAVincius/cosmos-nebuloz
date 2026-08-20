type LogoProps = {
  label: string;
  size?: number;
};

/**
 * Nebuloz wordmark.
 *
 * Deliberately not reused from `(home)/nebuloz/chrome.tsx`: that copy hardcodes
 * the retired `#7c6cff / #5b8cff / #3cc3ff` stops, and the old tree is meant to
 * stay byte-identical. Here the stops read the live palette vars, so a retune
 * reaches the mark.
 */
export function Logo({ label, size = 22 }: LogoProps) {
  return (
    <div aria-label={label} className="flex items-center gap-2.5" role="img">
      <svg
        aria-hidden="true"
        focusable="false"
        height={size}
        viewBox="0 0 32 32"
        width={size}
      >
        <defs>
          <linearGradient id="nz-readiness-logo" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--c-violet)" />
            <stop offset="50%" stopColor="var(--c-indigo)" />
            <stop offset="100%" stopColor="var(--c-cyan)" />
          </linearGradient>
        </defs>
        <circle
          cx="16"
          cy="16"
          fill="none"
          opacity="0.5"
          r="14"
          stroke="url(#nz-readiness-logo)"
          strokeWidth="1.4"
        />
        <path
          d="M9 22V10l14 12V10"
          fill="none"
          stroke="url(#nz-readiness-logo)"
          strokeLinecap="square"
          strokeWidth="2.2"
        />
        <circle
          cx="16"
          cy="16"
          fill="url(#nz-readiness-logo)"
          opacity="0.9"
          r="3"
        />
      </svg>
      <span className="font-semibold text-[15px] tracking-tight">Nebuloz</span>
    </div>
  );
}
