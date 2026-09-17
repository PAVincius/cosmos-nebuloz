import { Avatar, Badge, type Tone } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import type { ClientRow } from "@/app/actions/clients";

/**
 * Carteira de clientes — a tabela do `backoffice-tenant.jsx`.
 *
 * O protótipo mostra também setor, região e "health" por cliente. Nada disso
 * existe no schema, então nada disso aparece aqui: a alternativa seria a tela
 * afirmar coisas sobre o cliente que ninguém registrou, e um painel de
 * operação que inventa campo é pior que um painel com menos coluna.
 *
 * O que entra no lugar é o que é real: plano, número de membros e o status de
 * cada módulo contratado.
 */

const TOM_DE_STATUS: Record<string, Tone> = {
  ACTIVE: "green",
  TRIAL: "blue",
  SUSPENDED: "amber",
  CANCELED: "red",
};

const ROTULO_DE_STATUS: Record<string, string> = {
  ACTIVE: "Ativo",
  TRIAL: "Trial",
  SUSPENDED: "Suspenso",
  CANCELED: "Cancelado",
};

const CABECALHO: React.CSSProperties = {
  padding: "0 14px 8px",
  textAlign: "left",
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
};

const CELULA: React.CSSProperties = {
  padding: "11px 14px",
  borderTop: "1px solid var(--hairline)",
  fontSize: "var(--fs-base)",
  verticalAlign: "middle",
};

export function ClientesTabela({ clientes }: { clientes: ClientRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="mono" scope="col" style={CABECALHO}>
              Cliente
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Slug
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Módulos
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Plano
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Membros
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Desde
            </th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr className="lift" key={cliente.id}>
              <td style={CELULA}>
                <Link
                  href={`/clientes/${cliente.slug}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "var(--ink)",
                    textDecoration: "none",
                  }}
                >
                  <Avatar name={cliente.name} size={30} />
                  <span style={{ fontWeight: 700 }}>{cliente.name}</span>
                </Link>
              </td>
              <td
                className="mono"
                style={{
                  ...CELULA,
                  color: "var(--ink-subtle)",
                  fontSize: "var(--fs-base)",
                }}
              >
                {cliente.slug}
              </td>
              <td style={CELULA}>
                {cliente.modules.length === 0 ? (
                  <span
                    style={{
                      color: "var(--ink-faint)",
                      fontSize: "var(--fs-base)",
                    }}
                  >
                    nenhum módulo contratado
                  </span>
                ) : (
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {cliente.modules.map((m) => (
                      <Badge
                        dot
                        key={m.module}
                        tone={TOM_DE_STATUS[m.status] ?? "neutral"}
                      >
                        {m.module} · {ROTULO_DE_STATUS[m.status] ?? m.status}
                      </Badge>
                    ))}
                  </span>
                )}
              </td>
              <td style={CELULA}>
                <Badge soft={false} tone="purple">
                  {cliente.plan}
                </Badge>
              </td>
              <td
                className="mono"
                style={{ ...CELULA, fontSize: "var(--fs-base)" }}
              >
                {cliente.memberCount}
              </td>
              <td
                className="mono"
                style={{
                  ...CELULA,
                  color: "var(--ink-faint)",
                  fontSize: "var(--fs-base)",
                }}
              >
                {new Date(cliente.createdAt).toLocaleDateString("pt-BR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
