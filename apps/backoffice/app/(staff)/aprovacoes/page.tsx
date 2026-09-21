import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listPlatformApprovals } from "@/app/actions/approvals";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Secao } from "@/components/secao";
import { Vazio } from "@/components/vazio";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { requirePlatformStaff } from "@/lib/guard";
import { Decisao } from "./decisao";
import { Pedido } from "./pedido";

export const dynamic = "force-dynamic";

export const metadata = { title: tituloDaAba("/aprovacoes") };

export default async function AprovacoesPage() {
  // O guard roda na page, não só no layout: layout protege navegação, não RPC.
  const staff = await requirePlatformStaff();
  const res = await listPlatformApprovals();

  const cabecalho = (
    <PageHeader
      eyebrow={`${secaoDaRota("/aprovacoes")} · governança`}
      // O que passa por aqui hoje, de verdade: só o envio de proposta com
      // desconto acima do limite (proposals.ts). As outras quatro operações
      // do PRD §6.3 ainda não chamam `requestPlatformApproval` — prometer
      // que entram aqui é mentir para quem procura a remoção de um cliente.
      subtitle={`Operação sensível não executa no clique — ela entra aqui. Hoje: envio de proposta com desconto acima de ${LIMITE_DESCONTO_SEM_APROVACAO}%. Remoção de cliente, escrita de agentes de IA, export sensível e mudança de plano ainda não passam pela fila.`}
      title="Aprovações"
      tone="amber"
    />
  );

  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {cabecalho}
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar a fila"
        />
      </div>
    );
  }

  const pedidos = res.data;
  const pendentes = pedidos.filter((p) => p.status === "PENDING_APPROVAL");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {cabecalho}

      <Secao
        icon="approve"
        subtitle={
          pedidos.length === 0
            ? "Nada pendente"
            : `${pendentes.length} ${pendentes.length === 1 ? "pendente" : "pendentes"} de ${pedidos.length}`
        }
        title="Fila"
      >
        {pedidos.length === 0 ? (
          // Empty com saída, não beco: diz o que faz a fila encher — e o que
          // faz hoje, de verdade. A única action que chama
          // `requestPlatformApproval` é o envio de proposta (proposals.ts);
          // as outras quatro operações do PRD §6.3 ainda não passam por aqui.
          <Vazio>
            Nenhum pedido de aprovação. Hoje, o que entra nesta fila é o envio
            de proposta com desconto acima de {LIMITE_DESCONTO_SEM_APROVACAO}% —
            a proposta fica aguardando até alguém decidir aqui. As demais
            operações sensíveis ainda não passam pela fila.
          </Vazio>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {pedidos.map((p) => (
              <Pedido key={p.id} pedido={p}>
                {/* O alvo por extenso: a barreira de rejeitar mostra o
                    pedido que a pessoa reconhece, não o id. */}
                <Decisao
                  alvo={p.alvoLabel}
                  canWrite={staff.canWrite}
                  id={p.id}
                />
              </Pedido>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
