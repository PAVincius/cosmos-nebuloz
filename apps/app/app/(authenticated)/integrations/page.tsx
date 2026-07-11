import { Badge } from "@repo/design-system/components/cosmos/badge";
import { ActivityIcon, AlertTriangleIcon, Link2Icon } from "lucide-react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { getARTs } from "@/app/actions/arts/get-arts";
import { listIntegrations } from "@/app/actions/integrations";
import { getEpicsWithFeatureWSJF } from "@/app/actions/wsjf";
import { appDesign } from "@/lib/app-design";
import { IntegrationHub } from "./components/integration-hub";

export const metadata = {
  title: "Integração | COSMOS",
  description: "Conecte Linear, GitHub Projects, Asana e GitLab ao COSMOS SAFe",
};

// ─── Icons (KpiCard `iconPath` — single/combined SVG <path d> strings) ────────
// Re-skin of prototype's `screenIntegrations` (screens-admin.js:52).

const ICON_CHECK = "M20 6 9 17l-5-5";
const ICON_ACTIVITY =
  "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2";
const ICON_LINK = "M9 17H7A5 5 0 0 1 7 7h2 M15 7h2a5 5 0 1 1 0 10h-2";
const ICON_ALERT =
  "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3 M12 9v4 M12 17h.01";

export default async function IntegrationsPage() {
  const [integrationsResult, arts, epics] = await Promise.all([
    listIntegrations(),
    getARTs(),
    getEpicsWithFeatureWSJF(),
  ]);

  const integrations = integrationsResult.ok ? integrationsResult.data : [];
  const connected = integrations.filter((i) => i.status === "ACTIVE").length;
  const itemsSynced = integrations.reduce(
    (sum, i) =>
      sum +
      i.syncLogs.reduce(
        (logSum, log) => logSum + log.itemsCreated + log.itemsUpdated,
        0
      ),
    0
  );
  const importSources = integrations.filter((i) => i.syncLogs.length > 0).length;
  const disconnected = integrations.length - connected;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        badge={
          <>
            <Badge dot tone={connected > 0 ? "green" : "neutral"}>
              {connected} conectada{connected === 1 ? "" : "s"}
            </Badge>
            <Badge tone="neutral">
              {disconnected} desconectada{disconnected === 1 ? "" : "s"}
            </Badge>
            <RelationChip
              eyebrow="Monitoramento"
              href="/integrations/health"
              icon={<ActivityIcon />}
              label="Integration Health"
              tone="blue"
            />
            <RelationChip
              eyebrow="Importação"
              href="/integrations/linear/import"
              icon={<Link2Icon />}
              label="Import Linear"
              tone="accent"
            />
          </>
        }
        breadcrumb={[{ label: "Settings", href: "/settings/workspace" }]}
        subtitle="Hub de conexões com ferramentas externas. Conecte para sincronizar itens automaticamente."
        title="Integrações"
      />
      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {!integrationsResult.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>
              Falha ao carregar integrações: {integrationsResult.error}.{" "}
              <a className="underline" href="/integrations">
                Tentar novamente
              </a>
            </span>
          </div>
        )}

        <KpiGrid cols={4}>
          <KpiCard
            badge="— Ativas agora"
            iconPath={ICON_CHECK}
            label="Conectadas"
            tone="green"
            unit={`/${integrations.length}`}
            value={connected}
          />
          <KpiCard
            badge="— Épicos + features"
            iconPath={ICON_ACTIVITY}
            label="Itens sincronizados"
            tone="blue"
            value={itemsSynced}
          />
          <KpiCard
            badge="— Com dados"
            iconPath={ICON_LINK}
            label="Fontes de import"
            tone="accent"
            value={importSources}
          />
          <KpiCard
            badge="— Disponíveis"
            iconPath={ICON_ALERT}
            label="Desconectadas"
            tone="amber"
            value={disconnected}
          />
        </KpiGrid>

        <IntegrationHub
          arts={arts.map((a) => ({ id: a.id, name: a.name }))}
          epics={epics.map((e) => ({ id: e.id, title: e.title }))}
          integrations={integrations}
        />
      </div>
    </div>
  );
}
