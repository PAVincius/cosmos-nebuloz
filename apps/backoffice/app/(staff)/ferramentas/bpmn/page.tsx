import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { listClients } from "@/app/actions/clients";
import { listDiagrams } from "@/app/actions/diagrams";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { requirePlatformStaff } from "@/lib/guard";
import { Estudio } from "../estudio";

export const dynamic = "force-dynamic";

export default async function BpmnPage() {
  const [staff, res, clientes] = await Promise.all([
    requirePlatformStaff(),
    listDiagrams("BPMN"),
    listClients(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Ferramentas · BPMN 2.0"
        meta={<Badge tone="purple">self-hosted</Badge>}
        subtitle="Modelagem de processo versionada. O XML é a fonte da verdade — o canvas reflete o arquivo, e é ele que entra no diff de uma revisão."
        title="Modelagem BPMN"
        tone="purple"
      />
      {res.ok ? (
        <Estudio
          // Falha ao listar clientes não derruba o estúdio: o seletor fica
          // vazio e o resto da tela continua editável.
          clientes={clientes.ok ? clientes.data : []}
          iniciais={res.data}
          kind="BPMN"
          podeEscrever={staff.canWrite}
        />
      ) : (
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar os modelos"
        />
      )}
    </div>
  );
}
