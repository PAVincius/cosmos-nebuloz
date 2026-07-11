export type ProgressTone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "accent";

/**
 * Tone-colored progress bar — re-skin of cosmos.html `Progress` primitive
 * (cosmos-kit.jsx). Scoped to solution-trains: no shared `Progress`
 * primitive exists in components/, and shadcn's Progress can't expose
 * per-tone indicator color without a fork.
 */
export function ToneProgress({
  value,
  tone = "accent",
  height = 6,
}: {
  value: number;
  tone?: ProgressTone;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-surface-3"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${clamped}%`,
          background: `var(--${tone})`,
          boxShadow: `0 0 10px rgba(var(--${tone}-rgb),.5)`,
        }}
      />
    </div>
  );
}
