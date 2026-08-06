import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listProposals } from "@/app/actions/proposals";
import { listServices } from "@/app/actions/services";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { requirePlatformStaff } from "@/lib/guard";
import { Propostas } from "./propostas";

export const dynamic = "force-dynamic";

export default async function PropostasPage() {
  const [staff, propostas, servicos] = await Promise.all([
    requirePlatformStaff(),
    listProposals(),
    listServices(),
  ]);

  // Fora do JSX: o `&&` inline é lido pelo lint como valor vazando para o
  // render, e nomear a condição também diz o que ela significa.
  const tudoCarregou = propostas.ok && servicos.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · propostas"
        subtitle={`Itens saem do catálogo e o preço é congelado na criação. Desconto acima de ${LIMITE_DESCONTO_SEM_APROVACAO}% não envia no clique — entra na fila de aprovação.`}
        title="Propostas"
      />
      {tudoCarregou ? (
        <Propostas
          iniciais={propostas.data}
          podeEscrever={staff.canWrite}
          servicos={servicos.data}
        />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: 13 }}>
          {propostas.ok ? "" : propostas.error}
          {servicos.ok ? "" : servicos.error}
        </p>
      )}
    </div>
  );
}
