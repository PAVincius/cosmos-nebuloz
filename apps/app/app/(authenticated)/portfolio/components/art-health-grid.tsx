import type { ArtHealthRow } from "@/app/actions/portfolio/overview";

const LAYERS_PATH = "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";

function getHealth(ppm: number, hasData: boolean) {
  if (!hasData) {
    return {
      label: "Sem dados",
      color: "var(--ink-faint)",
      bg: "var(--hairline)",
      barColor: "var(--hairline)",
      shadowColor: "rgba(100,100,100,.3)",
    };
  }
  if (ppm >= 80) {
    return {
      label: "Saudável",
      color: "var(--green)",
      bg: "rgba(var(--green-rgb),.13)",
      barColor: "var(--green)",
      shadowColor: "rgba(var(--green-rgb),.5)",
    };
  }
  if (ppm >= 60) {
    return {
      label: "Atenção",
      color: "var(--amber)",
      bg: "rgba(var(--amber-rgb),.13)",
      barColor: "var(--amber)",
      shadowColor: "rgba(var(--amber-rgb),.5)",
    };
  }
  return {
    label: "Em risco",
    color: "var(--red)",
    bg: "rgba(var(--red-rgb),.13)",
    barColor: "var(--red)",
    shadowColor: "rgba(var(--red-rgb),.5)",
  };
}

function formatBudget(m: number) {
  if (m === 0) {
    return "—";
  }
  return `US$ ${m.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}M`;
}

export function ArtHealthGrid({ arts }: { arts: ArtHealthRow[] }) {
  if (arts.length === 0) {
    return null;
  }

  return (
    <section>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(124,135,255,.12)",
              border: "1px solid rgba(124,135,255,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              aria-hidden
              fill="none"
              height="14"
              stroke="var(--accent-c)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="14"
            >
              <path d={LAYERS_PATH} />
            </svg>
          </div>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--ink)",
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Agile Release Trains
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-faint)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {arts.length} ARTs ativas
        </span>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {arts.map((art) => {
          const health = getHealth(art.ppm, art.hasData);
          return (
            <div
              key={art.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 14,
                padding: "16px 18px",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,.03) inset, 0 8px 20px -14px rgba(0,0,0,.8)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* Card header: icon + name + health badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "var(--surface-3)",
                      border: "1px solid var(--hairline-strong)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      aria-hidden
                      fill="none"
                      height="13"
                      stroke="var(--ink-subtle)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="13"
                    >
                      <path d={LAYERS_PATH} />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {art.name}
                  </span>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: health.bg,
                    color: health.color,
                    whiteSpace: "nowrap",
                  }}
                >
                  {health.label}
                </span>
              </div>

              {/* Teams · membros */}
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-faint)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {art.teamCount} times · {art.memberCount} membros
              </div>

              {/* PPM row + progress bar */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--ink-faint)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    PPM
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: health.color,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    {art.hasData ? `${art.ppm}%` : "—"}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: "var(--hairline)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${art.ppm}%`,
                      borderRadius: 999,
                      background: health.barColor,
                      boxShadow: `0 0 8px ${health.shadowColor}`,
                    }}
                  />
                </div>
              </div>

              {/* Footer: épicos · features · budget */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  paddingTop: 4,
                  borderTop: "1px solid var(--hairline)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  {art.epicCount} épicos
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  ·
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  {art.featureCount} features
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  ·
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  {formatBudget(art.budgetM)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
