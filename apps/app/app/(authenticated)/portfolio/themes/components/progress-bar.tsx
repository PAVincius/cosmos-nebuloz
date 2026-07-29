import type { AccentTone } from "./theme-tone";
import { toneRgbVar, toneSolidVar } from "./theme-tone";

// Linear progress bar — mirrors cosmos-kit.jsx's Progress primitive.
export function ProgressBar({
  value,
  tone,
  height = 8,
}: {
  value: number;
  tone: AccentTone;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 999,
        background: "var(--surface-3)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background: toneSolidVar(tone),
          boxShadow: `0 0 10px rgba(${toneRgbVar(tone)},.5)`,
          transition: "width .6s cubic-bezier(.2,.7,.3,1)",
        }}
      />
    </div>
  );
}
