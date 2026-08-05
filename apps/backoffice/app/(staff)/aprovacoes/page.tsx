import { listPlatformApprovals } from "@/app/actions/approvals";
import { requirePlatformStaff } from "@/lib/guard";
import { Decisao } from "./decisao";

export const dynamic = "force-dynamic";

const ROTULO_STATUS: Record<string, string> = {
  PENDING_APPROVAL: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

function formatar(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export default async function AprovacoesPage() {
  // O guard roda na page, não só no layout: layout protege navegação, não RPC.
  const staff = await requirePlatformStaff();
  const res = await listPlatformApprovals();

  if (!res.ok) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
        <h1 className="font-semibold text-lg">Aprovações</h1>
        <p className="mt-2 text-red-600 text-sm dark:text-red-400">
          {res.error}
        </p>
      </div>
    );
  }

  const pedidos = res.data;
  const pendentes = pedidos.filter((p) => p.status === "PENDING_APPROVAL");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-semibold text-xl">Aprovações</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Operação sensível não executa no clique — ela entra aqui. Deleção de
          tenant, MCP writes avançadas, desconto acima de 15%, export sensível e
          mudança grande de plano.
        </p>
      </header>

      {pedidos.length === 0 ? (
        // Empty com saída, não beco: diz o que faz a fila encher.
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium text-sm">Nenhum pedido de aprovação.</p>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
            A fila enche sozinha quando alguém pede uma das operações sensíveis.
            Nenhuma delas está implementada ainda — elas chegam nas ondas 3 a 5.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-muted-foreground text-xs">
            {pendentes.length} pendente(s) de {pedidos.length}
          </p>
          <ul className="flex flex-col gap-3">
            {pedidos.map((p) => (
              <li className="rounded-lg border p-4" key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{p.acao}</span>
                      <span className="text-muted-foreground text-xs">
                        {p.alvoTipo} · {p.alvoLabel}
                      </span>
                    </div>
                    {/* FR-8.2 — motivo e impacto ficam na linha, não atrás de
                        um clique: aprovador não decide sem contexto. */}
                    <p className="mt-2 text-sm">{p.motivo}</p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Impacto estimado: {p.impacto}
                    </p>
                    <p className="mt-2 text-muted-foreground text-xs">
                      Pedido por {p.solicitanteNome ?? "—"} em{" "}
                      {formatar(p.criadoEm)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border px-2.5 py-1 font-semibold text-xs">
                    {ROTULO_STATUS[p.status] ?? p.status}
                  </span>
                </div>

                {p.status === "PENDING_APPROVAL" ? (
                  <Decisao canWrite={staff.canWrite} id={p.id} />
                ) : (
                  // FR-8.5 — decidido mostra a decisão, não os botões.
                  <p className="mt-3 border-t pt-3 text-muted-foreground text-xs">
                    {ROTULO_STATUS[p.status]} por {p.decisorNome ?? "—"} em{" "}
                    {p.decididoEm ? formatar(p.decididoEm) : "—"}
                    {p.nota ? ` — ${p.nota}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
