import dynamic from "next/dynamic";
import { listIntegrations } from "../../../actions/settings/integrations";

const IntegrationsBoard = dynamic(
  () =>
    import("./components/integrations-board").then(
      (m) => m.IntegrationsBoard
    ),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
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
    <div className="flex w-full min-w-0 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground text-sm">
          Conecte suas ferramentas externas ao COSMOS para sincronizar dados e
          automatizar fluxos de trabalho.
        </p>
      </div>
      <IntegrationsBoard initialIntegrations={integrations} />
    </div>
  );
}
