import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listCapacity } from "@/app/actions/capacity";
import { listEngagements } from "@/app/actions/engagements";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { requirePlatformStaff } from "@/lib/guard";
import { Capacidade } from "./capacidade";

export const dynamic = "force-dynamic";

export default async function CapacidadePage() {
  const [staff, pessoas, engajamentos] = await Promise.all([
    requirePlatformStaff(),
    listCapacity(),
    listEngagements(),
  ]);

  const tudoCarregou = pessoas.ok && engajamentos.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Delivery · equipe"
        subtitle="Capacidade por pessoa, não por papel — a equipe é multidisciplinar. Passar de 100% é permitido, mas nunca em silêncio: exige motivo, que fica na trilha."
        title="Capacidade"
      />
      {tudoCarregou ? (
        <Capacidade
          engajamentos={engajamentos.data}
          iniciais={pessoas.data}
          podeEscrever={staff.canWrite}
        />
      ) : (
        <FalhaAoCarregar
          motivo={[pessoas, engajamentos].flatMap((r) =>
            r.ok ? [] : [r.error]
          )}
          titulo="Não foi possível carregar a capacidade"
        />
      )}
    </div>
  );
}
