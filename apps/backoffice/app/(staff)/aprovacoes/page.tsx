import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { listPlatformApprovals } from "@/app/actions/approvals";
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
            ? "listPlatformApprovals()"
            : `${pendentes.length} pendente(s) de ${pedidos.length}`
        }
        title="Fila"
      >
        {pedidos.length === 0 ? (
          // Empty com saída, não beco: diz o que faz a fila encher.
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
            Nenhum pedido de aprovação. A fila enche sozinha quando alguém pede
            uma das operações sensíveis — nenhuma delas está implementada ainda,
            elas chegam nas ondas 3 a 5.
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
