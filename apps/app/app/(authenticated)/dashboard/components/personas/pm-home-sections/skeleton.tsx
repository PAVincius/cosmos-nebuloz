// ─── PmHomeBodySkeleton ────────────────────────────────────────────────────
// Loading state for the KPI row + backlog/INVEST/OKR cards while
// PmHomeBody's server-side data fetch (epics, features, impediments) resolves.

function ShimmerBlock({ height, width }: { height: number; width?: string }) {
  return (
    <span
      className="cosmos-pm-shimmer"
      style={{
        display: "block",
        height,
        width: width ?? "100%",
        borderRadius: "var(--cosmos-r-md, 8px)",
      }}
    />
  );
}

export function PmHomeBodySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @keyframes cosmos-pm-shimmer-sweep {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        .cosmos-pm-shimmer {
          background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
          background-size: 200% 100%;
          animation: cosmos-pm-shimmer-sweep 1.1s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cosmos-pm-shimmer { animation: none; }
        }
      `}</style>

      <div className="grid grid-cols-2 gap-[var(--cosmos-gap,16px)] sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: "var(--cosmos-r-lg, 12px)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <ShimmerBlock height={11} width="60%" />
            <ShimmerBlock height={26} width="40%" />
            <ShimmerBlock height={9} width="70%" />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: "var(--cosmos-gap,16px)",
        }}
      >
        <div
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--cosmos-r-lg, 12px)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <ShimmerBlock height={14} width="45%" />
          {[0, 1, 2, 3, 4].map((i) => (
            <ShimmerBlock height={32} key={i} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: "var(--cosmos-r-lg, 12px)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <ShimmerBlock height={14} width="60%" />
            {[0, 1].map((i) => (
              <ShimmerBlock height={44} key={i} />
            ))}
          </div>
          <div
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: "var(--cosmos-r-lg, 12px)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <ShimmerBlock height={14} width="55%" />
            {[0, 1].map((i) => (
              <ShimmerBlock height={40} key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
