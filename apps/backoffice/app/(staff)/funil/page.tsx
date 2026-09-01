import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listarLeads } from "@/app/actions/leads";
import { requirePlatformStaff } from "@/lib/guard";
import { Funil } from "./funil";

/**
 * Funil comercial (LEAD → DISCOVERY → EVALUATION).
 *
 * A metade que Proposal não cobre: os dois estágios seguintes já são
 * `Proposal.status`. Um lead sai daqui de dois jeitos — convertido, apontando
 * para a proposta que nasceu dele, ou perdido, com o motivo registrado. Sem
 * KPI de funil aqui de propósito: previsão de receita e métrica de conversão
 * ficam para quando houver volume real para dizer algo.
 */
export const dynamic = "force-dynamic";

export default async function FunilPage() {
  const [staff, leads] = await Promise.all([
    requirePlatformStaff(),
    listarLeads(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · funil"
        subtitle="Lead, descoberta, avaliação. Converte em proposta ou sai marcado como perdido — nenhum lead fica sem desfecho registrado."
        title="Funil"
      />

      {leads.ok ? (
        <Funil iniciais={leads.data} podeEscrever={staff.canWrite} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {leads.error}
        </p>
      )}
    </div>
  );
}
