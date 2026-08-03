import dynamic from "next/dynamic";
import { appDesign } from "@/lib/app-design";
import { listIntegrations } from "../../../actions/settings/integrations";
import { PageHeader } from "../../components/page-header";

const IntegrationsBoard = dynamic(
  () =>
    import("./components/integrations-board").then((m) => m.IntegrationsBoard),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar integrações…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Integrações | Configurações | COSMOS",
  description: "Conecte ferramentas externas ao COSMOS",
};

export default async function IntegrationsPage() {
  const result = await listIntegrations();
  const integrations = result.ok ? result.data : [];

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Configurações", href: "/settings/workspace" },
          { label: "Integrações" },
        ]}
        subtitle="Conecte suas ferramentas externas ao COSMOS para sincronizar dados e automatizar fluxos."
        title="Integrações"
      />
      <div className={appDesign.bodyScroll}>
        <IntegrationsBoard initialIntegrations={integrations} />
      </div>
    </div>
  );
}
