import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { listPlatformApprovals } from "@/app/actions/approvals";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Vazio } from "@/components/vazio";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { requirePlatformStaff } from "@/lib/guard";
import { Decisao } from "./decisao";
import { Pedido } from "./pedido";

export const dynamic = "force-dynamic";

export const metadata = { title: tituloDaAba("/aprovacoes") };

type Estado = "pendentes" | "decididos";

/** O link que troca de lado, no cabeçalho da fila. */
function LinkDoOutroLado({ estado }: { estado: Estado }) {
  const estilo = {
    fontSize: "var(--fs-nota)",
    fontWeight: 700,
    color: "var(--accent-text)",
  } as const;
  return estado === "pendentes" ? (
    <Link href="/aprovacoes?estado=decididos" style={estilo}>
      Ver decididos →
    </Link>
  ) : (
    <Link href="/aprovacoes" style={estilo}>
      ← Ver pendentes
    </Link>
  );
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Conta o que está na tela. Fora do JSX: inline, o lint lê o ternário
 *  encadeado como valor vazando. */
function subtituloDaFila(estado: Estado, quantos: number): string {
  if (estado === "decididos") {
    return plural(quantos, "decidido", "decididos");
  }
  return quantos === 0
    ? "Nada pendente"
    : plural(quantos, "pendente", "pendentes");
}

/**
 * Pendentes e decididos são dois lados da mesma fila, em `?estado=`. A tela
 * abre nos pendentes — é o que pede ação — e o subtítulo conta o que está
 * na tela, não um total que somava os dois lados. Decididos ficam a um
 * clique, em vez de empurrar os pendentes para baixo.
 */
export default async function AprovacoesPage({
  searchParams,
}: {
  searchParams?: Promise<{ estado?: string }>;
} = {}) {
  const estado: Estado =
    (await searchParams)?.estado === "decididos" ? "decididos" : "pendentes";
  // O guard roda na page, não só no layout: layout protege navegação, não RPC.
  const staff = await requirePlatformStaff();
  const res = await listPlatformApprovals(
    estado === "decididos" ? "DECIDIDOS" : "PENDING_APPROVAL"
  );

  const cabecalho = (
    <PageHeader
      eyebrow={`${secaoDaRota("/aprovacoes")} · governança`}
      subtitle="Operação sensível não executa no clique — ela entra aqui. Remoção de cliente, escrita de agentes de IA nos dados do cliente, desconto acima de 15%, export sensível e mudança grande de plano."
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
  const subtitulo = subtituloDaFila(estado, pedidos.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {cabecalho}

      <SectionCard
        action={<LinkDoOutroLado estado={estado} />}
        as="h2"
        icon="approve"
        subtitle={subtitulo}
        title={estado === "decididos" ? "Decididos" : "Fila"}
      >
        {pedidos.length === 0 && estado === "decididos" ? (
          <Vazio>Nenhum pedido decidido ainda.</Vazio>
        ) : null}
        {pedidos.length === 0 && estado === "pendentes" ? (
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
        ) : null}
        {pedidos.length > 0 ? (
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
        ) : null}
      </SectionCard>
    </div>
  );
}
