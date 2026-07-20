"use client";

// governance.tsx — Governance Board, wired to listGovernedEpics(). Lists real
// GovernedEpic rows with status + investment estimate. Gate policy editing,
// gate review/approve flow, and the per-epic Gate Detail page (RF §2.18) are
// NOT wired — read-only list for this pass.
import { useEffect, useState } from "react";
import {
  type GovernedEpicView,
  listGovernedEpics,
} from "@/app/(cosmos)/actions/governance";
import { Badge, ErrorState, PageHeader, SectionCard } from "../kit";

const STATUS_TONE: Record<
  string,
  "neutral" | "blue" | "green" | "red" | "amber"
> = {
  draft: "neutral",
  review: "blue",
  approved: "green",
  rejected: "red",
  on_hold: "amber",
  deferred: "amber",
};

export default function GovernanceScreen() {
  const [rows, setRows] = useState<GovernedEpicView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listGovernedEpics().then((r) => {
      if (r.ok) {
        setRows(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Governança"
        meta={<Badge tone="accent">{rows.length} épicos</Badge>}
        subtitle="Pipeline de gates de governança por épico."
        title="Governance Board"
      />
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="shield"
        title="Épicos em governança"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && rows.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum épico em governança.
            </span>
          )}
          {rows.map((g) => (
            <div
              key={g.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
                >
                  {g.epicTitle}
                </div>
                {g.investmentEstimate !== null && (
                  <div
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
                  >
                    ${g.investmentEstimate.toLocaleString()}
                  </div>
                )}
              </div>
              <Badge tone={STATUS_TONE[g.governanceStatus] ?? "neutral"}>
                {g.governanceStatus}
              </Badge>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
