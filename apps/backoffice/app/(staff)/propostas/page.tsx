import { KpiCard, PageHeader } from "@repo/design-system/cosmos/kit";
import { listProposals } from "@/app/actions/proposals";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { formatarBRL } from "@/lib/comercial/formato";
import { requirePlatformStaff } from "@/lib/guard";
import { Propostas } from "./propostas";

/**
 * Pipeline comercial (FR-12).
 *
 * A criação saiu daqui: quem monta proposta é o gerador, em /propostas/nova.
 * Esta tela é o funil — quanto está aberto, quanto se ganha, e o que abrir a
 * seguir. O catálogo de serviços também não desce mais para cá; ele é escolha
 * do gerador, e carregá-lo aqui era peso sem uso.
 */
export const dynamic = "force-dynamic";

/** Estados que ainda podem virar contrato. */
const EM_ABERTO = new Set(["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADA"]);

export default async function PropostasPage() {
  const [staff, propostas] = await Promise.all([
    requirePlatformStaff(),
    listProposals(),
  ]);

  if (!propostas.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader
          eyebrow="Comercial · propostas"
          subtitle="Do escopo ao contrato."
          title="Propostas"
        />
        <FalhaAoCarregar
          motivo={propostas.error}
          titulo="Não foi possível carregar as propostas"
        />
      </div>
    );
  }

  const lista = propostas.data;
  const abertas = lista.filter((p) => EM_ABERTO.has(p.status));
  const ganhas = lista.filter((p) => p.status === "ACEITA");
  const decididas = lista.filter((p) =>
    ["ACEITA", "RECUSADA"].includes(p.status)
  );

  // ACV vem gravado na proposta, não recalculado aqui: se o funil se refizesse
  // a cada leitura, mexer no preço de tabela mudaria o tamanho do pipeline
  // passado — inclusive o de propostas já enviadas.
  const pipelineAberto = abertas.reduce((s, p) => s + (p.acvCentavos ?? 0), 0);
  const ticketMedio =
    lista.length > 0
      ? Math.round(
          lista.reduce((s, p) => s + (p.acvCentavos ?? 0), 0) / lista.length
        )
      : 0;
  const winRate =
    decididas.length > 0
      ? Math.round((ganhas.length / decididas.length) * 100)
      : null;
  // Fora do JSX: inline, o lint lê o ternário como valor vazando para o render.
  const valorDoWinRate = winRate === null ? "—" : winRate;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · propostas"
        subtitle={`Do escopo ao contrato. Desconto acima de ${LIMITE_DESCONTO_SEM_APROVACAO}% não envia no clique — entra na fila de aprovação.`}
        title="Propostas"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: "var(--gap)",
        }}
      >
        <KpiCard
          hint={`${abertas.length} em aberto`}
          icon="tag"
          label="Pipeline aberto (ACV)"
          tone="amber"
          value={formatarBRL(pipelineAberto)}
        />
        <KpiCard
          hint={
            winRate === null
              ? "nenhuma decidida ainda"
              : `${ganhas.length} de ${decididas.length} decididas`
          }
          icon="check"
          label="Win rate"
          tone="green"
          unit={winRate === null ? undefined : "%"}
          value={valorDoWinRate}
        />
        <KpiCard
          hint="todas as propostas"
          icon="building"
          label="Ticket médio (ACV)"
          tone="accent"
          value={formatarBRL(ticketMedio)}
        />
        <KpiCard
          hint="aguardando RevOps"
          icon="clock"
          label="Na fila de aprovação"
          tone="blue"
          value={
            lista.filter((p) => p.status === "AGUARDANDO_APROVACAO").length
          }
        />
      </div>

      <Propostas iniciais={lista} podeEscrever={staff.canWrite} />
    </div>
  );
}
