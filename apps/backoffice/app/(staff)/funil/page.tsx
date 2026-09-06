import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { type LeadRow, listarFunil } from "@/app/actions/leads";
import { Erro } from "@/components/campo";
import { estagnado, type LeadFunil } from "@/lib/comercial/funil";
import { requirePlatformStaff } from "@/lib/guard";
import { Funil } from "./funil";

/**
 * Funil comercial v2 — quatro estágios com peso e teto, porta de entrada na
 * Escada, board de arrastar-e-soltar (spec
 * docs/superpowers/specs/2026-09-06-funil-v2-design.md §4).
 */
export const dynamic = "force-dynamic";

/** Mesma conversão local de board.tsx/tabela-leads.tsx/funil.tsx — aqui só
 *  para os dois badges do cabeçalho, que precisam de `estagnado()` antes do
 *  cliente montar. */
function paraLeadFunil(l: LeadRow): LeadFunil {
  return {
    id: l.id,
    estagio: l.estagio,
    estagioDesde: l.estagioDesde,
    situacao: l.situacao,
    acvEstimadoCentavos: l.acvEstimadoCentavos,
    proposta: l.proposta,
    entrada: l.entrada,
    canalSlug: l.canal?.slug ?? null,
    perdidoNoEstagio: l.perdidoNoEstagio,
  };
}

export default async function FunilPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listarFunil(),
  ]);

  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader
          eyebrow="Comercial · funil"
          subtitle="Quatro estágios com peso e teto. O funil promete, a proposta precifica, a capacidade aloca."
          title="Funil"
          tone="amber"
        />
        <Erro>{res.error}</Erro>
      </div>
    );
  }

  const { leads, estagios, hoje } = res.data;
  const hojeData = new Date(hoje);
  const ativos = leads.filter((l) => l.situacao === "ATIVO");
  const estagnados = ativos.filter((l) =>
    estagnado(paraLeadFunil(l), estagios, hojeData)
  ).length;
  const pelaEscada =
    leads.length === 0
      ? 0
      : Math.round(
          (leads.filter((l) => l.entrada === "MERIDIAN").length /
            leads.length) *
            100
        );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · funil"
        meta={
          <>
            <Badge tone="neutral">{ativos.length} ativos</Badge>
            {estagnados > 0 ? (
              <Badge dot tone="red">
                {estagnados} estagnados
              </Badge>
            ) : null}
            <Badge tone="blue">{pelaEscada}% entram pelo assessment</Badge>
          </>
        }
        subtitle="Quatro estágios com peso e teto. O funil promete, a proposta precifica, a capacidade aloca."
        title="Funil"
        tone="amber"
      />

      <Funil inicial={res.data} podeEscrever={staff.canWrite} />
    </div>
  );
}
