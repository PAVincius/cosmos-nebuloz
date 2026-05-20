import { listIntegrations } from "@/app/actions/integrations";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { PlugZapIcon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { IntegrationHub } from "./components/integration-hub";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getEpicsWithFeatureWSJF } from "@/app/actions/wsjf";

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
        title="Integration Hub"
        subtitle="Conecte ferramentas de execução ao COSMOS — times trabalham onde já trabalham, LPMs e RTEs têm visão unificada SAFe."
        stats={[
          { label: "Integrações",  value: integrations.length, icon: PlugZapIcon },
          { label: "Ativas",       value: active,              icon: CheckCircle2Icon },
          { label: "Com erro",     value: errors,              icon: AlertCircleIcon },
        ]}
      />
      <div className={appDesign.bodyScroll}>
        <IntegrationHub
          integrations={integrations}
          arts={arts.map((a) => ({ id: a.id, name: a.name }))}
          epics={epics.map((e) => ({ id: e.id, title: e.title }))}
        />
      </div>
    </div>
  );
}
