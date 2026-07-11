// Loading state — shimmer skeleton matching the KPI row + overview + list
// card shapes (DESIGN.md §6: "never a bare spinner for a full screen").

function ShimmerBlock({ height, width }: { height: number; width?: string }) {
  return (
    <span
      className="cosmos-horizon-shimmer"
      style={{
        display: "block",
        height,
        width: width ?? "100%",
        borderRadius: "var(--cosmos-r-md)",
        background:
          "linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

export function HorizonSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes cosmos-horizon-shimmer-sweep {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        .cosmos-horizon-shimmer { animation: cosmos-horizon-shimmer-sweep 1.1s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cosmos-horizon-shimmer { animation: none; }
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: 14,
              padding: 18,
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <ShimmerBlock height={11} width="60%" />
            <ShimmerBlock height={26} width="45%" />
            <ShimmerBlock height={18} width="80%" />
          </div>
        ))}
      </div>

      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: 14,
          padding: 18,
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <ShimmerBlock height={14} width="30%" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <ShimmerBlock height={64} key={i} />
          ))}
        </div>
        <ShimmerBlock height={10} />
      </div>

      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: 14,
            padding: 18,
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <ShimmerBlock height={14} width="35%" />
          <ShimmerBlock height={68} />
          <ShimmerBlock height={68} />
        </div>
      ))}
    </div>
  );
}
