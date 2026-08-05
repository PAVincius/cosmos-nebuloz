import type {
  AuditRow,
  IntegracaoRow,
} from "@/app/actions/tenant-observability";

/** Cor sozinha nunca carrega estado — cor + palavra, sempre (NFR-2.2). */
const TOM_STATUS: Record<string, string> = {
  ACTIVE:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  INACTIVE: "border-border bg-muted text-muted-foreground",
  ERROR: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

const ROTULO_STATUS: Record<string, string> = {
  ACTIVE: "OK",
  INACTIVE: "Não conectado",
  ERROR: "Erro",
};

function formatar(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export function Integracoes({ integracoes }: { integracoes: IntegracaoRow[] }) {
  if (integracoes.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
        Nenhuma integração configurada para este tenant. Elas são criadas dentro
        do produto, pelo próprio cliente — o back-office observa, não conecta.
      </p>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {integracoes.map((i) => (
        <li className="rounded-md border p-3" key={i.id}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{i.name}</span>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold text-xs ${
                TOM_STATUS[i.status] ?? TOM_STATUS.INACTIVE
              }`}
            >
              {ROTULO_STATUS[i.status] ?? i.status}
            </span>
          </div>
          <p className="mt-1 font-mono text-muted-foreground text-xs">
            {i.source} ·{" "}
            {i.ultimoSync
              ? `último sync ${formatar(i.ultimoSync)}`
              : "nunca sincronizou"}
          </p>
          {/* FR-4.4.2 — a causa concreta, não só o status. */}
          {i.mensagem ? (
            <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 text-red-600 text-xs dark:text-red-400">
              {i.mensagem}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * FR-4.9 — timeline do tenant; a linha expande e mostra o diff campo-a-campo.
 *
 * `<details>` nativo em vez de estado de cliente: a expansão é comportamento do
 * browser, funciona sem JS e já vem com teclado e leitor de tela corretos.
 */
export function AuditTimeline({ eventos }: { eventos: AuditRow[] }) {
  if (eventos.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
        Nenhum evento auditado para este tenant ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {eventos.map((e) => {
        const tuplas = Array.isArray(e.diff)
          ? (e.diff as [string, string, string][])
          : null;
        return (
          <li className="rounded-md border" key={e.id}>
            <details>
              <summary className="cursor-pointer list-none p-3 text-sm hover:bg-muted">
                <span className="font-mono text-xs">{e.action}</span>
                <span className="ml-2 text-muted-foreground">
                  {e.alvo ?? e.entityType ?? "—"}
                </span>
                <span className="ml-2 text-muted-foreground text-xs">
                  {formatar(e.quando)}
                  {e.ator ? ` · ${e.ator}` : ""}
                </span>
              </summary>
              <div className="border-t p-3">
                {e.semDiff ? (
                  // Afirmação explícita: linha que abre vazia parece quebrada.
                  <p className="text-muted-foreground text-xs">
                    Evento de criação — não tem diff, porque não havia estado
                    anterior.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-1 font-medium">Campo</th>
                        <th className="pb-1 font-medium">Antes</th>
                        <th className="pb-1 font-medium">Depois</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tuplas ? (
                        tuplas.map(([campo, antes, depois]) => (
                          <tr key={campo}>
                            <td className="py-0.5 font-mono">{campo}</td>
                            <td className="py-0.5 text-muted-foreground">
                              {String(antes)}
                            </td>
                            <td className="py-0.5">{String(depois)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="py-0.5 text-muted-foreground"
                            colSpan={3}
                          >
                            <code>{JSON.stringify(e.diff)}</code>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
