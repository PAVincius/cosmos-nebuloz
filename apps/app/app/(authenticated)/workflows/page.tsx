import { requireTenantSession } from "@repo/auth/server";
import { Badge } from "@repo/design-system/components/cosmos/badge";
import { database } from "@repo/database";
import { Plug, Users, Webhook, Workflow } from "lucide-react";
import { headers } from "next/headers";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import { appDesign } from "@/lib/app-design";
import type { WorkflowRowData, WorkflowTone } from "./components/workflow-row";
import { WorkflowRow } from "./components/workflow-row";
import { WorkflowActions } from "./components/workflow-actions";

export const metadata = {
  title: "Workflows | COSMOS",
  description: "Automações BPMN 2.0 por equipe",
};

// Raw lucide `d` paths — KpiCard takes a single SVG path string, not a component.
const ICON_ACTIVITY =
  "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2";
const ICON_ZAP =
  "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";
const ICON_CHECK = "M20 6 9 17l-5-5";

function toneForEntityType(entityType: string | undefined): WorkflowTone {
  switch (entityType) {
    case "STORY":
      return "green";
    case "FEATURE":
      return "purple";
    case "EPIC":
      return "blue";
    case "CUSTOM":
      return "amber";
    default:
      return "accent";
  }
}

async function getTeamsWithWorkflows(tenantId: string) {
  const teams = await database.team.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  const definitions = await database.bpmnDefinition.findMany({
    where: { tenantId },
    select: {
      id: true,
      ownerId: true,
      version: true,
      name: true,
      entityType: true,
      triggerLabel: true,
      actionCount: true,
      runCount: true,
      active: true,
    },
    orderBy: { version: "desc" },
    distinct: ["ownerId"],
  });

  const defMap = new Map(definitions.map((d) => [d.ownerId, d]));

  return teams.map((t) => ({ ...t, definition: defMap.get(t.id) ?? null }));
}

export default async function WorkflowsPage() {
  const ctx = await requireTenantSession(await headers());
  const teams = await getTeamsWithWorkflows(ctx.tenantId);

  const configuredTeams = teams.filter((t) => t.definition !== null);
  const activeCount = configuredTeams.filter(
    (t) => t.definition?.active
  ).length;
  const totalRuns = configuredTeams.reduce(
    (sum, t) => sum + (t.definition?.runCount ?? 0),
    0
  );

  const rows: WorkflowRowData[] = teams.map((team, index) => ({
    id: team.id,
    code: `WF-${String(index + 1).padStart(2, "0")}`,
    name: team.definition?.name ?? team.name,
    trigger: team.definition?.triggerLabel ?? null,
    actionCount: team.definition?.actionCount ?? 0,
    runCount: team.definition?.runCount ?? 0,
    active: team.definition?.active ?? false,
    tone: toneForEntityType(team.definition?.entityType),
    definitionId: team.definition?.id ?? null,
  }));

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <WorkflowActions
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          />
        }
        badge={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <RelationChip
              eyebrow="Times"
              href="/teams"
              icon={<Users />}
              label="Equipes"
              tone="neutral"
            />
            <RelationChip
              eyebrow="Automação"
              href="/integrations"
              icon={<Plug />}
              label="Integrações"
              tone="accent"
            />
            <RelationChip
              eyebrow="Automação"
              href="/webhooks"
              icon={<Webhook />}
              label="Webhooks"
              tone="purple"
            />
          </div>
        }
        subtitle="Automações no-code do portfólio. Cada workflow dispara ações a partir de eventos — promover gates, notificar, sincronizar ferramentas."
        title="Workflows"
      />

      <div className={appDesign.bodyScroll}>
        <KpiGrid cols={3}>
          <KpiCard
            badge={`de ${configuredTeams.length} configurados`}
            iconPath={ICON_ACTIVITY}
            label="Workflows ativos"
            tone="accent"
            value={activeCount}
          />
          <KpiCard
            badge="ações automáticas registradas"
            iconPath={ICON_ZAP}
            label="Execuções acumuladas"
            tone="purple"
            value={totalRuns}
          />
          <KpiCard
            badge="times com workflow salvo"
            iconPath={ICON_CHECK}
            label="Equipes cobertas"
            tone="green"
            value={`${configuredTeams.length}/${teams.length}`}
          />
        </KpiGrid>

        <div style={{ marginTop: "var(--gap, 24px)" }}>
          <SectionCard
            actions={
              <Badge dot tone="green">
                motor de eventos ativo
              </Badge>
            }
            icon={Workflow}
            noPadding
            subtitle="Gatilho → ações · ordenadas por equipe"
            title="Automações"
          >
            {rows.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-1 py-16 text-center"
                style={{ padding: "48px 32px" }}
              >
                <Workflow size={28} style={{ color: "var(--ink-faint)" }} />
                <p
                  className="font-medium text-sm"
                  style={{ color: "var(--ink)" }}
                >
                  Nenhuma equipe encontrada
                </p>
                <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  Crie equipes em ARTs para modelar fluxos BPMN
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 12,
                }}
              >
                {rows.map((row) => (
                  <WorkflowRow actorId={ctx.userId} key={row.id} row={row} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
