import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listDiagrams } from "@/app/actions/diagrams";
import { requirePlatformStaff } from "@/lib/guard";
import { Estudio } from "../estudio";

export const dynamic = "force-dynamic";

export default async function BpmnPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listDiagrams("BPMN"),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Ferramentas · BPMN 2.0"
        subtitle="Modelagem de processo versionada. O XML é a fonte da verdade — o canvas reflete o arquivo, e é ele que entra no diff de uma revisão."
        title="Modelagem BPMN"
      />
      {res.ok ? (
        <Estudio
          iniciais={res.data}
          kind="BPMN"
          podeEscrever={staff.canWrite}
        />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: 13 }}>{res.error}</p>
      )}
    </div>
  );
}
