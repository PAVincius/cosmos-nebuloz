const SURFACE_1 = "#0f1011";
const SURFACE_2 = "#141516";
const HAIRLINE = "#23252a";
const CANVAS = "#010102";

const cellStyle: React.CSSProperties = {
  background: SURFACE_1,
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 12,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const barBase: React.CSSProperties = {
  background: SURFACE_2,
  borderRadius: 4,
  animation: "bento-pulse 2s ease-in-out infinite",
};

function Bar({
  width = "100%",
  height = 10,
  opacity = 1,
  delay = 0,
}: {
  width?: string | number;
  height?: number;
  opacity?: number;
  delay?: number;
}) {
  return (
    <div
      style={{
        ...barBase,
        width,
        height,
        opacity,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

function Cell({
  height,
  gridColumn,
  delays = [0, 0.1, 0.2],
}: {
  height: number;
  gridColumn?: string;
  delays?: number[];
}) {
  return (
    <div style={{ ...cellStyle, height, gridColumn }}>
      <Bar delay={delays[0]} width="60%" />
      <Bar delay={delays[1]} width="85%" />
      <Bar delay={delays[2]} width="40%" />
    </div>
  );
}

export default function Loading() {
  return (
    <div
      style={{
        background: CANVAS,
        minHeight: "100%",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <style>{`
        @keyframes bento-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>

      {/* Page header skeleton */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Bar delay={0} height={20} width={120} />
          <Bar delay={0.1} height={13} opacity={0.6} width={280} />
        </div>
        <Bar delay={0.15} height={12} opacity={0.5} width={80} />
      </div>

      {/* Bento grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {/* Row 1: 4 × span-1 cells, height 120px */}
        <Cell delays={[0, 0.1, 0.2]} height={120} />
        <Cell delays={[0.05, 0.15, 0.25]} height={120} />
        <Cell delays={[0.1, 0.2, 0.3]} height={120} />
        <Cell delays={[0.15, 0.25, 0.35]} height={120} />

        {/* Row 2: 2 × span-2 cells, height 160px */}
        <Cell delays={[0, 0.1, 0.2]} gridColumn="span 2" height={160} />
        <Cell delays={[0.1, 0.2, 0.3]} gridColumn="span 2" height={160} />

        {/* Row 3: span-2, span-1, span-1, height 140px */}
        <Cell delays={[0, 0.1, 0.2]} gridColumn="span 2" height={140} />
        <Cell delays={[0.1, 0.2, 0.3]} height={140} />
        <Cell delays={[0.15, 0.25, 0.35]} height={140} />
      </div>
    </div>
  );
}
