import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  type AuditEventoRow,
  listAuditEvents,
  listAuditTenants,
} from "@/app/actions/audit";
import { LinkExportarCsv } from "@/components/exportar-csv";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { itemDaRota, secaoDaRota, tituloDaAba } from "@/components/nav";
import { Secao } from "@/components/secao";
import { Vazio } from "@/components/vazio";
import { formatarDataHora } from "@/lib/data";
import { Filtros, Paginacao } from "./filtros";
import { ACOES } from "./rotulos";

export const dynamic = "force-dynamic";

type Busca = {
  tenant?: string;
  acao?: string;
  entidade?: string;
  de?: string;
  ate?: string;
  pagina?: string;
};

/**
 * O cliente da linha, como saída para a aba Audit dele. Fica fora do
 * `<summary>`, como irmão do `<details>`: dentro, o link ficaria sob o papel
 * de botão do summary — controle dentro de controle, que o leitor de tela
 * achata. O tenant interno (e o que não está no seletor) fica texto: não tem
 * detalhe de cliente para onde ir.
 */
function ClienteDaLinha({
  slug,
  ehCliente,
}: {
  slug: string;
  ehCliente: boolean;
}) {
  const badge = <Badge tone="blue">{slug}</Badge>;
  return (
    <span style={{ padding: "9px 0 9px 6px" }}>
      {ehCliente ? (
        <Link
          href={`/clientes/${slug}?aba=audit`}
          style={{ textDecoration: "none" }}
        >
          <span className="sr-only">Trilha do cliente </span>
          {badge}
        </Link>
      ) : (
        badge
      )}
    </span>
  );
}

function Linha({
  evento,
  ehCliente,
}: {
  evento: AuditEventoRow;
  ehCliente: boolean;
}) {
  const tuplas = Array.isArray(evento.diff)
    ? (evento.diff as [string, string, string][])
    : null;

  return (
    <li
      style={{
        listStyle: "none",
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        alignItems: "start",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <ClienteDaLinha ehCliente={ehCliente} slug={evento.tenantSlug} />
      {/* `<details>` nativo: a expansão funciona sem JS e já vem com teclado e
          leitor de tela corretos. Numa lista de centenas de linhas, também
          evita um estado de cliente por linha. */}
      <details>
        <summary
          className="navitem"
          style={{
            cursor: "pointer",
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 6px",
            fontSize: "var(--fs-base)",
          }}
        >
          {/* `listStyle: none` apagou o triângulo nativo; sem ele a linha
              parece texto parado. O chevron gira em `details[open]` (CSS em
              backoffice-theme.css). */}
          <Icon className="bo-chevron" name="chevronRight" size={14} />
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", fontWeight: 700 }}
          >
            {ACOES[evento.action] ?? evento.action}
          </span>
          <span style={{ flex: 1, minWidth: 0, color: "var(--ink-muted)" }}>
            {evento.alvo ?? evento.entityType ?? "—"}
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {formatarDataHora(evento.quando)}
            {evento.ator ? ` · ${evento.ator}` : ""}
          </span>
        </summary>

        <div style={{ padding: "4px 6px 14px" }}>
          {evento.semDiff ? (
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
            <table style={{ width: "100%", fontSize: "var(--fs-nota)" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-faint)" }}>
                  <th scope="col" style={{ paddingBottom: 4 }}>
                    Campo
                  </th>
                  <th scope="col" style={{ paddingBottom: 4 }}>
                    Antes
                  </th>
                  <th scope="col" style={{ paddingBottom: 4 }}>
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
                      <td style={{ color: "var(--ink-muted)" }}>
                        {String(antes)}
                      </td>
                      <td>{String(depois)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ color: "var(--ink-muted)" }}>
                      <code>{JSON.stringify(evento.diff)}</code>
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
}

export const metadata = { title: tituloDaAba("/audit") };

/** O filtro da tela na URL da exportação, nos mesmos nomes. A página
 *  (`?pagina=`) fica de fora: o arquivo leva o filtro inteiro, não os 50 que
 *  estão à vista. */
function hrefDaExportacao(q: Busca): string {
  const params = new URLSearchParams();
  for (const chave of ["tenant", "acao", "entidade", "de", "ate"] as const) {
    const valor = q[chave];
    if (valor) {
      params.set(chave, valor);
    }
  }
  const consulta = params.toString();
  return consulta ? `/audit/exportar?${consulta}` : "/audit/exportar";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const q = await searchParams;
  const [tenants, pagina] = await Promise.all([
    listAuditTenants(),
    listAuditEvents({
      tenantId: q.tenant,
      action: q.acao,
      entityType: q.entidade,
      de: q.de,
      ate: q.ate,
      pagina: q.pagina ? Number(q.pagina) : undefined,
    }),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/audit")} · plataforma`}
        subtitle="Busca sobre o AuditLog de todos os clientes ao mesmo tempo. O filtro fica na URL — o link abre a mesma busca para quem receber."
        title={itemDaRota("/audit")?.label ?? "Trilha de auditoria"}
      />

      <Secao icon="filter" title="Filtro">
        {tenants.ok ? (
          <Filtros tenants={tenants.data} />
        ) : (
          <FalhaAoCarregar
            motivo={tenants.error}
            titulo="Não foi possível carregar os clientes do filtro"
          />
        )}
      </Secao>

      <Secao
        action={<LinkExportarCsv href={hrefDaExportacao(q)} />}
        icon="history"
        subtitle={
          pagina.ok
            ? `${pagina.data.total} ${pagina.data.total === 1 ? "evento" : "eventos"} no filtro atual`
            : "Não foi possível carregar"
        }
        title="Eventos"
      >
        {renderEventos(
          pagina,
          // Os clientes que têm detalhe: o seletor já lê a carteira inteira,
          // sem o tenant interno. Sem essa lista, nenhum slug vira link.
          new Set(tenants.ok ? tenants.data.map((t) => t.slug) : [])
        )}
      </Secao>
    </div>
  );
}

function renderEventos(
  pagina: Awaited<ReturnType<typeof listAuditEvents>>,
  clientes: Set<string>
) {
  if (!pagina.ok) {
    return (
      <FalhaAoCarregar
        motivo={pagina.error}
        titulo="Não foi possível carregar os eventos"
      />
    );
  }

  if (pagina.data.eventos.length === 0) {
    // Empty com saída: diz o que fazer, não só que não achou.
    return (
      <Vazio>
        Nenhum evento neste filtro. Amplie o período ou limpe o cliente para ver
        a plataforma inteira.
      </Vazio>
    );
  }

  return (
    <>
      <ul style={{ margin: 0, padding: 0 }}>
        {pagina.data.eventos.map((e) => (
          <Linha ehCliente={clientes.has(e.tenantSlug)} evento={e} key={e.id} />
        ))}
      </ul>
      <Paginacao
        pagina={pagina.data.pagina}
        porPagina={pagina.data.porPagina}
        total={pagina.data.total}
      />
    </>
  );
}
