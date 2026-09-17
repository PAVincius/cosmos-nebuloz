import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { listClients } from "@/app/actions/clients";
import { listDiagrams } from "@/app/actions/diagrams";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { requirePlatformStaff } from "@/lib/guard";
import { Estudio } from "../estudio";

export const dynamic = "force-dynamic";

export default async function DiagramasPage() {
  const [staff, res, clientes] = await Promise.all([
    requirePlatformStaff(),
    listDiagrams("MERMAID"),
    listClients(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Ferramentas · diagrama como código"
        meta={<Badge tone="blue">self-hosted</Badge>}
        subtitle="A DSL é a fonte da verdade e é versionável em git; o canvas reflete o texto. Renderiza no navegador — nenhum byte do diagrama sai daqui."
        title="Diagramas"
        tone="blue"
      />
      {res.ok ? (
        <Estudio
          // Falha ao listar clientes não derruba o estúdio: o seletor fica
          // vazio e o resto da tela continua editável.
          clientes={clientes.ok ? clientes.data : []}
          iniciais={res.data}
          kind="MERMAID"
          podeEscrever={staff.canWrite}
        />
      ) : (
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar os diagramas"
        />
      )}
    </div>
  );
}
