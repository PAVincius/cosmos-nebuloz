import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listarPromocoesPendentes } from "@/app/actions/scaffold";
import { listServices } from "@/app/actions/services";
import { requirePlatformStaff } from "@/lib/guard";
import { Scaffold } from "./scaffold";

/**
 * Fila de promoções de Scaffold pendentes (ADR-0014).
 *
 * O Meridian já sabe promover uma lacuna para Scaffold — o que falta é essa
 * promoção aterrissar num `Engagement`. Esta tela é a fila: o que foi
 * promovido e ainda não virou trabalho, agrupado por cliente, porque o
 * engajamento é sempre de um cliente só.
 */
export const dynamic = "force-dynamic";

export default async function ScaffoldPage() {
  const [staff, promocoes, servicos] = await Promise.all([
    requirePlatformStaff(),
    listarPromocoesPendentes(),
    listServices(),
  ]);

  const tudoCarregou = promocoes.ok && servicos.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · scaffold"
        subtitle="Promoções de lacuna do Meridian que ainda não viraram engajamento. Selecione uma ou mais do mesmo cliente e materialize."
        title="Scaffold"
      />

      {tudoCarregou ? (
        <Scaffold
          iniciais={promocoes.data}
          podeEscrever={staff.canWrite}
          servicos={servicos.data}
        />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {promocoes.ok ? "" : promocoes.error}
          {servicos.ok ? "" : servicos.error}
        </p>
      )}
    </div>
  );
}
