import { AlertCircleIcon, CheckCircle2Icon, PlugZapIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getARTs } from "@/app/actions/arts/get-arts";
import { listIntegrations } from "@/app/actions/integrations";
import { getEpicsWithFeatureWSJF } from "@/app/actions/wsjf";
import { appDesign } from "@/lib/app-design";
import { IntegrationHub } from "./components/integration-hub";

export const metadata = {
  title: "Integration Hub | COSMOS",
  description: "Conecte Linear, GitHub Projects, Asana e GitLab ao COSMOS SAFe",
};

export default async function IntegrationsPage() {
  const [integrationsResult, arts, epics] = await Promise.all([
    listIntegrations(),
    getARTs(),
    getEpicsWithFeatureWSJF(),
  ]);

  const integrations = integrationsResult.ok ? integrationsResult.data : [];
  const active = integrations.filter((i) => i.status === "ACTIVE").length;
  const errors = integrations.filter((i) => i.status === "ERROR").length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "Settings", href: "/settings/workspace" }]}
        stats={[
          {
            label: "Integrações",
            value: integrations.length,
            icon: PlugZapIcon,
          },
          { label: "Ativas", value: active, icon: CheckCircle2Icon },
          { label: "Com erro", value: errors, icon: AlertCircleIcon },
        ]}
        subtitle="Conecte ferramentas de execução ao COSMOS — times trabalham onde já trabalham, LPMs e RTEs têm visão unificada SAFe."
        title="Integration Hub"
      />
      <div className={appDesign.bodyScroll}>
        <IntegrationHub
          arts={arts.map((a) => ({ id: a.id, name: a.name }))}
          epics={epics.map((e) => ({ id: e.id, title: e.title }))}
          integrations={integrations}
        />
      </div>
    </div>
  );
}
