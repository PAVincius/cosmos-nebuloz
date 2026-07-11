import type { CSSProperties } from "react";

// ponytail: pure-CSS periodic beams + dot pattern. Fixed, behind content,
// fills the dead space between sections with quiet motion. No canvas/JS loop.
const BEAMS: { left: string; color: string; dur: string; delay: string; rot: string; op: string }[] = [
  { left: "10%", color: "var(--c-violet)", dur: "19s", delay: "0s", rot: "-14deg", op: "0.11" },
  { left: "46%", color: "var(--c-cyan)", dur: "23s", delay: "-8s", rot: "12deg", op: "0.09" },
  { left: "78%", color: "var(--c-indigo)", dur: "21s", delay: "-14s", rot: "-8deg", op: "0.08" },
];

export function BackgroundBeams() {
  return (
    <div className="bg-beams" aria-hidden="true">
      {BEAMS.map((b, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          key={i}
          className="bg-beam"
          style={
            {
              left: b.left,
              background: `linear-gradient(180deg, transparent, ${b.color}, transparent)`,
              "--beam-dur": b.dur,
              "--beam-delay": b.delay,
              "--beam-rot": b.rot,
              "--beam-op": b.op,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
