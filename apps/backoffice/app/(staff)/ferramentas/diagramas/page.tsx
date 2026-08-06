import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listDiagrams } from "@/app/actions/diagrams";
import { requirePlatformStaff } from "@/lib/guard";
import { Estudio } from "../estudio";

export const dynamic = "force-dynamic";

export default async function DiagramasPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listDiagrams("MERMAID"),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Ferramentas · diagrama como código"
        subtitle="A DSL é a fonte da verdade e é versionável em git; o canvas reflete o texto. Renderiza no navegador — nenhum byte do diagrama sai daqui."
        title="Diagramas"
      />
      {res.ok ? (
        <Estudio
          iniciais={res.data}
          kind="MERMAID"
          podeEscrever={staff.canWrite}
        />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: 13 }}>{res.error}</p>
      )}
    </div>
  );
}
