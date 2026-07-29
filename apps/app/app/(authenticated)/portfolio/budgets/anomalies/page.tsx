import { Badge } from "@repo/design-system/components/cosmos/badge";
import { DollarSign, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { listRecentAnomalies } from "@/app/actions/flow-intelligence/list-anomalies";
import { appDesign } from "@/lib/app-design";
import { AnomalyList } from "./components/anomaly-list";

export const metadata = {
  title: "Anomalias de Flow — COSMOS",
  description:
    "Histórico de anomalias detectadas pelo Copilot AI nos snapshots de Flow Metrics.",
};

export default async function AnomaliesPage() {
  const { anomalies, stats } = await listRecentAnomalies(100);

  const open = anomalies.filter(
    (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
  );
  const scopesAffected = new Set(anomalies.map((a) => a.run.scopeId)).size;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <>
            <RelationChip
              eyebrow="Portfolio"
              href="/portfolio/budgets"
              icon={<DollarSign />}
              label="Lean Budget"
              tone="amber"
            />
            <RelationChip
              eyebrow="Escalar para"
              href="/portfolio/governance"
              icon={<ShieldAlert />}
              label="Governança"
              tone="purple"
            />
          </>
        }
        badge={
          <>
            <Badge dot tone="red">
              {open.length} críticas/altas
            </Badge>
            <Badge tone="neutral">{scopesAffected} escopos afetados</Badge>
            <Badge dot tone="green">
              {stats.total} analisadas
            </Badge>
          </>
        }
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Lean Budget", href: "/portfolio/budgets" },
        ]}
        subtitle="Anomalias detectadas pelo Copilot AI nas últimas análises de Flow Metrics."
        title="Anomalias de Flow"
      />
      <div className={appDesign.bodyScroll}>
        <AnomalyList anomalies={anomalies} stats={stats} />
      </div>
    </div>
  );
}
