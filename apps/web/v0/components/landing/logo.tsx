interface LogoProps {
  iconSize?: number;
  wordmarkClassName?: string;
  showWordmark?: boolean;
  className?: string;
}

/** Dyson sphere mark: encased star core + two orbital swarm rings. */
function DysonMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nz-ring" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--nz-violet, #7c6cff)" />
          <stop offset="1" stopColor="var(--nz-cyan, #3cc3ff)" />
        </linearGradient>
        <radialGradient id="nz-core" cx="12" cy="12" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#cfc8ff" />
          <stop offset="1" stopColor="var(--nz-violet, #7c6cff)" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="3" fill="url(#nz-core)" />
      <g stroke="url(#nz-ring)" strokeWidth="1.3" fill="none">
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-22 12 12)" opacity="0.9" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(42 12 12)" opacity="0.55" />
      </g>
    </svg>
  );
}

export function Logo({
  iconSize = 26,
  wordmarkClassName = "text-2xl",
  showWordmark = true,
  className = "",
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <DysonMark size={iconSize} />
      {showWordmark && (
        <span className={`font-display tracking-tight grad-text ${wordmarkClassName}`}>Nebuloz</span>
      )}
    </span>
  );
}
