import {
  KpiCard,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { type ClientRow, listClients } from "@/app/actions/clients";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota } from "@/components/nav";
import { ClientesTabela } from "./clientes-tabela";

/**
 * Carteira de clientes (`backoffice-tenant.jsx`).
 *
 * Os quatro KPIs do protótipo saem todos de dado real: `ModuleStatus` já tem
 * ACTIVE, TRIAL, SUSPENDED e CANCELED no schema, então "trials em andamento" e
 * "exigem atenção" são contagens, não enfeite. Se algum deles dependesse de
 * campo inexistente, o certo seria não mostrar o card.
 */
function contar(clientes: ClientRow[]) {
  const modulos = clientes.flatMap((c) => c.modules);
  return {
    tenants: clientes.length,
    ativos: modulos.filter((m) => m.status === "ACTIVE").length,
    trials: modulos.filter((m) => m.status === "TRIAL").length,
    atencao: modulos.filter((m) => m.status === "SUSPENDED").length,
  };
}

export default async function ClientsPage() {
  const result = await listClients();

  // O cabeçalho fica nos dois caminhos: erro dentro da moldura do sucesso, não
  // um parágrafo solto que faz a tela parecer outra.
  const cabecalho = (
    <PageHeader
      eyebrow={`${secaoDaRota("/")} · carteira`}
      subtitle="Todos os clientes provisionados, seus módulos e status de contratação."
      title="Carteira de clientes"
    >
      <Link
        className="btn"
        href="/clientes/novo"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 15px",
          borderRadius: "var(--r-md)",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          border: "1px solid var(--accent)",
          fontSize: "var(--fs-forte)",
          fontWeight: 600,
          textDecoration: "none",
          boxShadow:
            "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)",
        }}
      >
        + Provisionar cliente
      </Link>
    </PageHeader>
  );

  if (!result.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {cabecalho}
        <FalhaAoCarregar
          motivo={result.error}
          titulo="Não foi possível carregar a carteira"
        />
      </div>
    );
  }

  const clientes = result.data;
  const kpi = contar(clientes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {cabecalho}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        }}
      >
        <KpiCard
          hint="clientes provisionados"
          icon="building"
          label="Clientes na carteira"
          tone="blue"
          value={kpi.tenants}
        />
        <KpiCard
          hint="contratos vigentes"
          icon="layers"
          label="Módulos ativos"
          tone="green"
          value={kpi.ativos}
        />
        <KpiCard
          hint="candidatos a conversão"
          icon="activity"
          label="Trials em andamento"
          tone="accent"
          value={kpi.trials}
        />
        <KpiCard
          hint="módulos suspensos"
          icon="alert"
          label="Exigem atenção"
          tone="amber"
          value={kpi.atencao}
        />
      </div>

      <SectionCard
        icon="building"
        subtitle="Todos os clientes da plataforma. O nome abre o detalhe."
        title="Clientes"
      >
        {clientes.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 28,
              textAlign: "center",
              color: "var(--ink-muted)",
              fontSize: "var(--fs-base)",
            }}
          >
            Nenhum cliente provisionado ainda. Comece pelo{" "}
            <Link href="/clientes/novo" style={{ color: "var(--accent-text)" }}>
              Provisionar cliente
            </Link>
            .
          </p>
        ) : (
          <ClientesTabela clientes={clientes} />
        )}
      </SectionCard>
    </div>
  );
}
