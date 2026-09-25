import { KpiCard, PageHeader } from "@repo/design-system/cosmos/kit";
import {
  type AgregadoDasPropostas,
  agregadoDasPropostas,
} from "@/app/actions/agregados";
import { listProposals } from "@/app/actions/proposals";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Sigla } from "@/components/sigla";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { formatarBRL } from "@/lib/comercial/formato";
import { requirePlatformStaff } from "@/lib/guard";
import type { Result } from "@/lib/safe-action";
import { Propostas } from "./propostas";

/**
 * Pipeline comercial (FR-12).
 *
 * A criação saiu daqui: quem monta proposta é o gerador, em /propostas/nova.
 * Esta tela é o funil — quanto está aberto, quanto se ganha, e o que abrir a
 * seguir. O catálogo de serviços também não desce mais para cá; ele é escolha
 * do gerador, e carregá-lo aqui era peso sem uso.
 *
 * Os KPIs são de todas as propostas (`actions/agregados.ts`), não da lista:
 * a lista para no teto e cresce por "Mostrar mais".
 */
export const dynamic = "force-dynamic";

const ACV = "valor anual do contrato";

export const metadata = { title: tituloDaAba("/propostas") };

function Kpis({ agregado }: { agregado: Result<AgregadoDasPropostas> }) {
  if (!agregado.ok) {
    // Sem a contagem, nenhum número: o da lista seria o da página.
    return (
      <FalhaAoCarregar
        motivo={agregado.error}
        titulo="Não foi possível contar as propostas"
      />
    );
  }
  const k = agregado.data;
  // ACV vem gravado na proposta, não recalculado aqui: se o funil se refizesse
  // a cada leitura, mexer no preço de tabela mudaria o tamanho do pipeline
  // passado — inclusive o de propostas já enviadas.
  const winRate =
    k.decididas > 0 ? Math.round((k.ganhas / k.decididas) * 100) : null;
  // Fora do JSX: inline, o lint lê o ternário como valor vazando para o render.
  const valorDoWinRate = winRate === null ? "—" : winRate;

  return (
    <div className="bo-kpis">
      <KpiCard
        hint={`${k.abertas} em aberto`}
        icon="tag"
        label={
          <>
            Pipeline aberto · <Sigla expandida sigla="ACV" significado={ACV} />
          </>
        }
        tone="amber"
        value={formatarBRL(k.pipelineAbertoCentavos)}
      />
      <KpiCard
        hint={
          winRate === null
            ? "nenhuma decidida ainda"
            : `${k.ganhas} de ${k.decididas} decididas`
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
        label={
          <>
            Ticket médio · <Sigla sigla="ACV" significado={ACV} />
          </>
        }
        tone="accent"
        value={formatarBRL(k.ticketMedioCentavos)}
      />
      <KpiCard
        hint="aguardando RevOps"
        icon="clock"
        label="Na fila de aprovação"
        tone="blue"
        value={k.naFila}
      />
    </div>
  );
}

export default async function PropostasPage() {
  const [staff, propostas, agregado] = await Promise.all([
    requirePlatformStaff(),
    listProposals(),
    agregadoDasPropostas(),
  ]);

  if (!propostas.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader
          eyebrow={`${secaoDaRota("/propostas")} · propostas`}
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/propostas")} · propostas`}
        subtitle={`Do escopo ao contrato. Desconto acima de ${LIMITE_DESCONTO_SEM_APROVACAO}% não envia no clique — entra na fila de aprovação.`}
        title="Propostas"
      />

      <Kpis agregado={agregado} />

      <Propostas
        iniciais={propostas.data}
        podeEscrever={staff.canWrite}
        total={agregado.ok ? agregado.data.total : null}
      />
    </div>
  );
}
