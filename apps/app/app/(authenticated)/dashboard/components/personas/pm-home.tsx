import { Flag, LayoutGrid } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "../../../components/page-header";
import { RelationChip } from "../../../components/relation-chip";
import { PmHomeBody } from "./pm-home-sections/pm-home-body";
import { PmHomeBodySkeleton } from "./pm-home-sections/skeleton";

type PmHomeProps = {
  okrs: Array<{
    id: string;
    title: string;
    epicId?: string | null;
    keyResults: Array<{
      id: string;
      title: string;
      current: number;
      target: number;
      unit?: string | null;
    }>;
  }>;
  activeView?: string;
};

/** PO dashboard (`#/dashboard` persona PO → `screenDashPO`). */
export default function PmHome({ okrs }: PmHomeProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        accentRgb="22,163,74"
        actions={
          <RelationChip
            eyebrow="Kanban"
            href="/portfolio"
            icon={<LayoutGrid />}
            label="Portfolio Kanban"
            tone="green"
          />
        }
        badge={
          <span
            style={{
              alignItems: "center",
              background: "rgba(var(--green-rgb),.12)",
              border: "1px solid rgba(var(--green-rgb),.25)",
              borderRadius: 999,
              color: "var(--green-text)",
              display: "inline-flex",
              fontSize: 11,
              fontWeight: 600,
              gap: 6,
              padding: "4px 10px",
            }}
          >
            <Flag aria-hidden size={12} />
            Product Owner
          </span>
        }
        subtitle="Backlog de features priorizado por WSJF, épicos para refinar e INVEST scores da ART."
        title="Dashboard · PO"
      />

      <Suspense fallback={<PmHomeBodySkeleton />}>
        <PmHomeBody okrs={okrs} />
      </Suspense>
    </div>
  );
}
