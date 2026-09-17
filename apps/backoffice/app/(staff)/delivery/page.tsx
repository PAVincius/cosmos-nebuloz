import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listAuditTenants } from "@/app/actions/audit";
import { listEngagements } from "@/app/actions/engagements";
import { listServices } from "@/app/actions/services";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { requirePlatformStaff } from "@/lib/guard";
import { Engajamentos } from "./engajamentos";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const [staff, engajamentos, clientes, servicos] = await Promise.all([
    requirePlatformStaff(),
    listEngagements(),
    listAuditTenants(),
    listServices(),
  ]);

  const tudoCarregou = engajamentos.ok && clientes.ok && servicos.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Delivery · contratos"
        subtitle="Escopo fechado: valor e entrega são acordados na assinatura e não variam com o esforço gasto. Quem mede esforço é a alocação, em Capacidade."
        title="Engajamentos"
      />
      {tudoCarregou ? (
        <Engajamentos
          clientes={clientes.data}
          iniciais={engajamentos.data}
          podeEscrever={staff.canWrite}
          servicos={servicos.data}
        />
      ) : (
        <FalhaAoCarregar
          motivo={[engajamentos, clientes, servicos].flatMap((r) =>
            r.ok ? [] : [r.error]
          )}
          titulo="Não foi possível carregar os engajamentos"
        />
      )}
    </div>
  );
}
