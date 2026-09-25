import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { type AgregadoDoFunil, agregadoDoFunil } from "@/app/actions/agregados";
import { listarFunil } from "@/app/actions/leads";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { requirePlatformStaff } from "@/lib/guard";
import type { Result } from "@/lib/safe-action";
import { Funil } from "./funil";

/**
 * Funil comercial v2 — quatro estágios com peso e teto, porta de entrada na
 * Escada, board de arrastar-e-soltar (spec
 * docs/superpowers/specs/2026-09-06-funil-v2-design.md §4).
 */
export const dynamic = "force-dynamic";

export const metadata = { title: tituloDaAba("/funil") };

/** O cabeçalho conta o funil inteiro (`actions/agregados.ts`); o board mostra
 *  os leads carregados. Contado sobre o board, "100 ativos" era o teto da
 *  lista. Sem a contagem, o cabeçalho diz isso em vez de chutar. */
function Meta({ agregado }: { agregado: Result<AgregadoDoFunil> }) {
  if (!agregado.ok) {
    return <Badge tone="neutral">contagem indisponível</Badge>;
  }
  const { ativos, estagnados, pelaEscada } = agregado.data;
  return (
    <>
      <Badge tone="neutral">{ativos} ativos</Badge>
      {estagnados > 0 ? (
        <Badge dot tone="red">
          {estagnados} estagnados
        </Badge>
      ) : null}
      {pelaEscada === null ? null : (
        <Badge tone="blue">{pelaEscada}% entram pelo assessment</Badge>
      )}
    </>
  );
}

export default async function FunilPage() {
  const [staff, res, agregado] = await Promise.all([
    requirePlatformStaff(),
    listarFunil(),
    agregadoDoFunil(),
  ]);

  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader
          eyebrow={`${secaoDaRota("/funil")} · funil`}
          subtitle="Quatro estágios com peso e teto. O funil promete, a proposta precifica, a capacidade aloca."
          title="Funil"
          tone="amber"
        />
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar o funil"
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/funil")} · funil`}
        meta={<Meta agregado={agregado} />}
        subtitle="Quatro estágios com peso e teto. O funil promete, a proposta precifica, a capacidade aloca."
        title="Funil"
        tone="amber"
      />

      <Funil inicial={res.data} podeEscrever={staff.canWrite} />
    </div>
  );
}
