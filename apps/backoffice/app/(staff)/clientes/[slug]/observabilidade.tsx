import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, type Tone } from "@repo/design-system/cosmos/kit";
import type {
  AuditRow,
  IntegracaoRow,
} from "@/app/actions/tenant-observability";
import { Vazio } from "@/components/vazio";
import { formatarDataHora } from "@/lib/data";

/** Cor sozinha nunca carrega estado — cor + palavra, sempre (NFR-2.2). O
 *  `Badge` do kit já é isso: o tom pinta, o texto informa. */
const TOM_STATUS: Record<string, Tone> = {
  ACTIVE: "green",
  INACTIVE: "neutral",
  ERROR: "red",
};

const ROTULO_STATUS: Record<string, string> = {
  ACTIVE: "OK",
  INACTIVE: "Não conectado",
  ERROR: "Erro",
};

const CELULA_META: React.CSSProperties = {
  padding: "2px 0",
  color: "var(--ink-faint)",
};

function formatar(iso: string): string {
  return formatarDataHora(iso);
}

export function Integracoes({ integracoes }: { integracoes: IntegracaoRow[] }) {
  if (integracoes.length === 0) {
    return (
      <Vazio>
        Nenhuma integração configurada para este cliente. Elas são criadas
        dentro do produto, pelo próprio cliente — o back-office observa, não
        conecta.
      </Vazio>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
      }}
    >
      {integracoes.map((i) => (
        <li
          key={i.id}
          style={{
            padding: 12,
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
              {i.name}
            </span>
            <Badge tone={TOM_STATUS[i.status] ?? "neutral"}>
              {ROTULO_STATUS[i.status] ?? i.status}
            </Badge>
          </div>
          <p
            className="mono"
            style={{
              margin: "6px 0 0",
              fontSize: "var(--fs-nota)",
              color: "var(--ink-faint)",
            }}
          >
            {i.source} ·{" "}
            {i.ultimoSync
              ? `último sync ${formatar(i.ultimoSync)}`
              : "nunca sincronizou"}
          </p>
          {/* FR-4.4.2 — a causa concreta, não só o status. Mesma moldura do
              `Erro`, um degrau menor porque vive dentro do cartão. */}
          {i.mensagem ? (
            <p
              style={{
                margin: "8px 0 0",
                padding: "7px 9px",
                borderRadius: "var(--r-sm)",
                background: "var(--red-soft)",
                border: "1px solid rgba(var(--red-rgb),.3)",
                color: "var(--red-text)",
                fontSize: "var(--fs-nota)",
                fontWeight: 600,
              }}
            >
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
    return <Vazio>Nenhum evento auditado para este cliente ainda.</Vazio>;
  }

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {eventos.map((e) => {
        const tuplas = Array.isArray(e.diff)
          ? (e.diff as [string, string, string][])
          : null;
        return (
          <li
            key={e.id}
            style={{
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline)",
              overflow: "hidden",
            }}
          >
            <details>
              <summary
                className="navitem"
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  padding: 12,
                  fontSize: "var(--fs-base)",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {/* Mesmo chevron do Audit Explorer: o `listStyle: none`
                    apagou o triângulo nativo. Gira em `details[open]`. */}
                <Icon className="bo-chevron" name="chevronRight" size={14} />
                <span className="mono" style={{ fontSize: "var(--fs-nota)" }}>
                  {e.action}
                </span>
                <span style={{ color: "var(--ink-muted)" }}>
                  {e.alvo ?? e.entityType ?? "—"}
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-nota)",
                    color: "var(--ink-faint)",
                  }}
                >
                  {formatar(e.quando)}
                  {e.ator ? ` · ${e.ator}` : ""}
                </span>
              </summary>
              <div
                style={{ borderTop: "1px solid var(--hairline)", padding: 12 }}
              >
                {e.semDiff ? (
                  // Afirmação explícita: linha que abre vazia parece quebrada.
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-nota)",
                      color: "var(--ink-faint)",
                    }}
                  >
                    Evento de criação — não tem diff, porque não havia estado
                    anterior.
                  </p>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "var(--fs-nota)",
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          style={{
                            ...CELULA_META,
                            textAlign: "left",
                            fontWeight: 700,
                            paddingBottom: 5,
                          }}
                        >
                          Campo
                        </th>
                        <th
                          scope="col"
                          style={{
                            ...CELULA_META,
                            textAlign: "left",
                            fontWeight: 700,
                            paddingBottom: 5,
                          }}
                        >
                          Antes
                        </th>
                        <th
                          scope="col"
                          style={{
                            ...CELULA_META,
                            textAlign: "left",
                            fontWeight: 700,
                            paddingBottom: 5,
                          }}
                        >
                          Depois
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tuplas ? (
                        tuplas.map(([campo, antes, depois]) => (
                          <tr key={campo}>
                            <td className="mono" style={{ padding: "2px 0" }}>
                              {campo}
                            </td>
                            <td style={CELULA_META}>{String(antes)}</td>
                            <td style={{ padding: "2px 0" }}>
                              {String(depois)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={CELULA_META}>
                            <code className="mono">
                              {JSON.stringify(e.diff)}
                            </code>
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
