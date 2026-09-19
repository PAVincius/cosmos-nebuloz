import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { notFound } from "next/navigation";
import { lerAvaliacao } from "@/app/actions/maturidade";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { requirePlatformStaff } from "@/lib/guard";
import { Avaliacao } from "./avaliacao";

/**
 * Folha de respostas de uma avaliação: dezoito critérios, cinco níveis cada,
 * com o score por dimensão recalculado a cada resposta.
 *
 * Rascunho recalcula ao vivo; concluída mostra o número congelado no fecho —
 * são coisas diferentes de propósito, e a tela diz qual está vendo.
 */
export const dynamic = "force-dynamic";

export default async function AvaliacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    lerAvaliacao(id),
  ]);

  // Id que não existe não é falha de leitura: retry não resolve. O
  // `not-found.tsx` do grupo já existe — é ele que responde.
  if (!res.ok && res.code === "NOT_FOUND") {
    notFound();
  }
  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader
          eyebrow="Growth · maturidade de IA"
          subtitle="Seis dimensões, cinco níveis."
          title="Avaliação"
          tone="purple"
        />
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível abrir a avaliação"
        />
      </div>
    );
  }

  const a = res.data;
  const concluida = a.status === "CONCLUIDA";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Growth · maturidade de IA"
        meta={
          <>
            {concluida ? (
              <Badge tone="green">Concluída</Badge>
            ) : (
              <Badge tone="amber">Rascunho</Badge>
            )}
            <Badge tone="neutral">rubrica {a.rubricaVersao}</Badge>
            {a.leadNome ? (
              <Badge tone="blue">via funil · {a.leadNome}</Badge>
            ) : null}
          </>
        }
        subtitle={
          concluida
            ? "Score congelado no fecho. Ele não muda quando a rubrica muda."
            : "Cada resposta pede a evidência que a sustenta. Sem os dezoito critérios, não há score."
        }
        title={a.organizacao}
        tone="purple"
      />

      <Avaliacao inicial={a} podeEscrever={staff.canWrite} />
    </div>
  );
}
