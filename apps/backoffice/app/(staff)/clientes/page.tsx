import {
  KpiCard,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  type AgregadoDaCarteira,
  agregadoDaCarteira,
} from "@/app/actions/agregados";
import { listClients } from "@/app/actions/clients";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Vazio } from "@/components/vazio";
import type { Result } from "@/lib/safe-action";
import { ClientesTabela, KpiAtencao } from "../clientes-tabela";

/**
 * Carteira de clientes (`backoffice-tenant.jsx`).
 *
 * Mora em `/clientes` desde a crítica rodada 5: `/` virou a Home, porque a
 * primeira pergunta do dia é "preciso fazer alguma coisa?", não "quem está na
 * carteira?". O detalhe já era `/clientes/[slug]` e o provisionar
 * `/clientes/novo`; agora a lista mora na mesma raiz que eles.
 *
 * Os quatro KPIs do protótipo saem todos de dado real: `ModuleStatus` já tem
 * ACTIVE, TRIAL, SUSPENDED e CANCELED no schema, então "trials em andamento" e
 * "exigem atenção" são contagens, não enfeite. E são contagens da carteira
 * inteira (`actions/agregados.ts`), não da lista: a lista para no teto, e
 * "Clientes na carteira: 100" com 140 clientes é dado errado sem erro.
 */
function Kpis({ agregado }: { agregado: Result<AgregadoDaCarteira> }) {
  if (!agregado.ok) {
    // Sem a contagem, nenhum número: o da lista seria o da página.
    return (
      <FalhaAoCarregar
        motivo={agregado.error}
        titulo="Não foi possível contar a carteira"
      />
    );
  }
  const kpi = agregado.data;
  return (
    <div className="bo-kpis">
      <KpiCard
        hint="clientes provisionados"
        icon="building"
        label="Clientes na carteira"
        tone="blue"
        value={kpi.clientes}
      />
      <KpiCard
        hint="contratos vigentes"
        icon="layers"
        label="Módulos ativos"
        tone="green"
        value={kpi.modulosAtivos}
      />
      <KpiCard
        hint="candidatos a conversão"
        icon="activity"
        label="Trials em andamento"
        tone="accent"
        value={kpi.trials}
      />
      {/* O único KPI que também filtra: pressionado, a tabela mostra só
          quem tem módulo suspenso (`?atencao=1`). */}
      <KpiAtencao valor={kpi.suspensos} />
    </div>
  );
}

export const metadata = { title: tituloDaAba("/clientes") };

export default async function ClientsPage() {
  const [result, agregado] = await Promise.all([
    listClients(),
    agregadoDaCarteira(),
  ]);

  // O cabeçalho fica nos dois caminhos: erro dentro da moldura do sucesso, não
  // um parágrafo solto que faz a tela parecer outra.
  const cabecalho = (
    <PageHeader
      eyebrow={`${secaoDaRota("/clientes")} · carteira`}
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {cabecalho}

      <Kpis agregado={agregado} />

      <SectionCard
        as="h2"
        icon="building"
        subtitle="Todos os clientes da plataforma. O nome abre o detalhe."
        title="Clientes"
      >
        {clientes.length === 0 ? (
          <Vazio>
            Nenhum cliente provisionado ainda. Comece pelo{" "}
            <Link href="/clientes/novo" style={{ color: "var(--accent-text)" }}>
              Provisionar cliente
            </Link>
            .
          </Vazio>
        ) : (
          <ClientesTabela clientes={clientes} />
        )}
      </SectionCard>
    </div>
  );
}
