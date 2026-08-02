import { appDesign } from "@/lib/app-design";
import { listMeetingIntegrations } from "../../../../actions/meeting/integrations";
import { PageHeader } from "../../../components/page-header";
import { MeetingIntegrationsClient } from "./meeting-integrations-client";

export const metadata = {
  title: "Meeting Intelligence | Integrações | COSMOS",
  description: "Conecte ferramentas de transcrição (Fireflies) ao COSMOS",
};

export default async function MeetingIntegrationsPage() {
  const result = await listMeetingIntegrations();
  const integrations = result.ok ? result.data : [];

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Configurações", href: "/settings/workspace" },
          { label: "Integrações", href: "/settings/integrations" },
          { label: "Meeting Intelligence" },
        ]}
        subtitle="Capture decisões, riscos e ações das cerimônias SAFe automaticamente a partir das transcrições."
        title="Meeting Intelligence"
      />
      <div className={appDesign.bodyScroll}>
        <MeetingIntegrationsClient initial={integrations} />
      </div>
    </div>
  );
}
