import { Building2Icon, CalendarIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { getPIPlans, getRisks } from "@/app/actions/risks";
import { appDesign } from "@/lib/app-design";
import { Badge } from "@repo/design-system/components/cosmos/badge";
import { CreateRiskDialog } from "./components/create-risk-dialog";
import { RisksContent } from "./components/risks-content";

export const metadata = {
  title: "Riscos | COSMOS",
  description: "Registro de riscos ROAM classificado por severidade",
};

// screen-risks.jsx (RisksScreen) — matriz de risco + registro de riscos.
export default async function RisksPage() {
  const [risks, piPlans] = await Promise.all([getRisks(), getPIPlans()]);

  const critical = risks.filter(
    (r) => r.impact === "critical" && r.status !== "RESOLVED"
  ).length;
  const open = risks.filter((r) => r.status === "OWNED").length;
  const resolved = risks.filter(
    (r) => r.status === "RESOLVED" || r.status === "MITIGATED"
  ).length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={<CreateRiskDialog piPlans={piPlans} />}
        badge={
          <>
            <Badge dot tone="red">
              {critical} críticos
            </Badge>
            <Badge tone="amber">{open} em aberto (Owned)</Badge>
            <Badge tone="green">{resolved} endereçados</Badge>
            <RelationChip
              eyebrow="Planejamento"
              href="/pi-planning"
              icon={<CalendarIcon />}
              label="PI Planning"
              tone="accent"
            />
            <RelationChip
              eyebrow="Squads"
              href="/arts"
              icon={<Building2Icon />}
              label="ARTs"
              tone="blue"
            />
          </>
        }
        subtitle="Registro de riscos classificado por ROAM e severidade (probabilidade × impacto). Revisado a cada sync de PI."
        title="Riscos"
      />
      <div className={appDesign.bodyScroll}>
        <RisksContent initialRisks={risks} piPlans={piPlans} />
      </div>
    </div>
  );
}
