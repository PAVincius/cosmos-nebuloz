import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { listPlatformApprovals } from "@/app/actions/approvals";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { requirePlatformStaff } from "@/lib/guard";
import { Decisao } from "./decisao";
import { Pedido } from "./pedido";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  // O guard roda na page, não só no layout: layout protege navegação, não RPC.
  const staff = await requirePlatformStaff();
  const res = await listPlatformApprovals();

  const cabecalho = (
    <PageHeader
      eyebrow="Plataforma · governança"
      subtitle="Operação sensível não executa no clique — ela entra aqui. Deleção de tenant, MCP writes avançadas, desconto acima de 15%, export sensível e mudança grande de plano."
      title="Aprovações"
      tone="amber"
    />
  );

  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {cabecalho}
        <SectionCard title="Fila" tone="red">
          <p
            role="alert"
            style={{
              margin: 0,
              padding: "11px 13px",
              borderRadius: "var(--r-md)",
              background: "var(--red-soft)",
              border: "1px solid rgba(var(--red-rgb),.3)",
              color: "var(--red-text)",
              fontSize: "var(--fs-base)",
              fontWeight: 600,
            }}
          >
            {res.error}
          </p>
        </SectionCard>
      </div>
    );
  }

  const pedidos = res.data;
  const pendentes = pedidos.filter((p) => p.status === "PENDING_APPROVAL");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {cabecalho}

      <SectionCard
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
          <p
            style={{
              margin: 0,
              padding: 28,
              textAlign: "center",
              color: "var(--ink-muted)",
              fontSize: "var(--fs-base)",
              lineHeight: 1.6,
            }}
          >
            Nenhum pedido de aprovação. Hoje, o que entra nesta fila é o envio
            de proposta com desconto acima de {LIMITE_DESCONTO_SEM_APROVACAO}% —
            a proposta fica aguardando até alguém decidir aqui. As demais
            operações sensíveis ainda não passam pela fila.
          </p>
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
                <Decisao canWrite={staff.canWrite} id={p.id} />
              </Pedido>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
