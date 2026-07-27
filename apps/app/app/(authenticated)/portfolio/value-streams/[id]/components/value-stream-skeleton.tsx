// apps/app/app/(authenticated)/portfolio/value-streams/[id]/components/value-stream-skeleton.tsx

// Loading state — shimmer skeleton matching the KPI row + description +
// card shapes (DESIGN.md §6: "never a bare spinner for a full screen").

function ShimmerBlock({ height, width }: { height: number; width?: string }) {
  return (
    <span
      className="cosmos-vs-shimmer"
      style={{
        display: "block",
        height,
        width: width ?? "100%",
        borderRadius: 8,
        background:
          "linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

export function ValueStreamSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes cosmos-vs-shimmer-sweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .cosmos-vs-shimmer { animation: cosmos-vs-shimmer-sweep 1.1s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cosmos-vs-shimmer { animation: none; }
        }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: 14,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <ShimmerBlock height={14} width="60%" />
            <ShimmerBlock height={26} width="45%" />
            <ShimmerBlock height={14} width="30%" />
          </div>
        ))}
      </div>

      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <ShimmerBlock height={14} width="35%" />
        <ShimmerBlock height={68} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: 14,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <ShimmerBlock height={14} width="30%" />
            <ShimmerBlock height={64} />
            <ShimmerBlock height={64} />
          </div>
        ))}
      </div>
    </div>
  );
}
