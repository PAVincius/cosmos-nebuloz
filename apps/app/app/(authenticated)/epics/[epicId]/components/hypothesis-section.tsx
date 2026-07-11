import { FlaskConicalIcon } from "lucide-react";
import { SectionCard } from "@/app/(authenticated)/components/section-card";

const PLACEHOLDER_OUTCOMES = [
  "Latência p95 < 120ms",
  "Deploy independente por domínio",
  "Zero downtime em releases",
];

const PLACEHOLDER_INDICATORS = [
  "Latência por release",
  "Frequência de deploy",
  "Taxa de rollback",
];

type HypothesisSectionProps = {
  hypothesis: string | null;
  businessOutcomes: unknown;
  leadingIndicators: unknown;
};

function parseList(raw: unknown, placeholder: string[]): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return placeholder;
  return raw
    .filter((item): item is { text: string } => item && typeof item.text === "string")
    .map((item) => item.text);
}

export function HypothesisSection({
  hypothesis,
  businessOutcomes,
  leadingIndicators,
}: HypothesisSectionProps) {
  const outcomes = parseList(businessOutcomes, PLACEHOLDER_OUTCOMES);
  const indicators = parseList(leadingIndicators, PLACEHOLDER_INDICATORS);

  const hypothesisText =
    hypothesis ??
    "Acreditamos que desacoplar o serviço de autorização em microsserviços reduzirá a latência p95 em 40% e permitirá deploys independentes. Saberemos pela métrica de latência e frequência de deploy.";

  return (
    <SectionCard
      icon={FlaskConicalIcon}
      subtitle="Leap of Faith · MVP framing"
      title="Hipótese"
    >
      <p style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.6, marginBottom: 20 }}>
        {hypothesisText}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Business Outcomes */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-faint)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            Business Outcomes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {outcomes.map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span style={{ fontSize: 13, color: "var(--ink-subtle)", lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leading Indicators */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-faint)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            Leading Indicators
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {indicators.map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-c)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
                  <path d="M22 7l-8.5 8.5-5-5L1 18" />
                </svg>
                <span style={{ fontSize: 13, color: "var(--ink-subtle)", lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
