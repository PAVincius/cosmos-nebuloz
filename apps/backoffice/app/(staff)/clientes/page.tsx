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
import { type ClientRow, listClients } from "@/app/actions/clients";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Vazio } from "@/components/vazio";
import { type Pagina, TETO_DA_LISTA } from "@/lib/paginacao";
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

/** A primeira página da carteira. Com `?atencao=1` o filtro é do banco —
 *  filtrado no navegador, o suspenso da página 2 não aparecia. Sem ele, a
 *  chamada de sempre, e "há mais" é a página ter vindo cheia
 *  (`components/mostrar-mais.tsx`). */
async function lerCarteira(
  soAtencao: boolean
): Promise<Result<Pagina<ClientRow>>> {
  if (soAtencao) {
    return await listClients({ atencao: true, pagina: 1 });
  }
  const res = await listClients();
  if (!res.ok) {
    return { code: res.code, error: res.error, ok: false };
  }
  return {
    data: { itens: res.data, temMais: res.data.length >= TETO_DA_LISTA },
    ok: true,
  };
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ atencao?: string }>;
} = {}) {
  const soAtencao = (await searchParams)?.atencao === "1";
  const [result, agregado] = await Promise.all([
    lerCarteira(soAtencao),
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

  const { itens: clientes, temMais } = result.data;
  // Vazio com o filtro ligado é "ninguém exige atenção", e quem diz é a
  // tabela — não "nenhum cliente provisionado".
  const carteiraVazia = !soAtencao && clientes.length === 0;

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
        {carteiraVazia ? (
          <Vazio>
            Nenhum cliente provisionado ainda. Comece pelo{" "}
            <Link href="/clientes/novo" style={{ color: "var(--accent-text)" }}>
              Provisionar cliente
            </Link>
            .
          </Vazio>
        ) : (
          // A chave troca com o filtro: a tabela guarda a lista e as páginas
          // carregadas, e a lista filtrada é outra lista.
          <ClientesTabela
            clientes={clientes}
            key={soAtencao ? "atencao" : "todos"}
            temMais={temMais}
            total={agregado.ok ? agregado.data.clientes : null}
          />
        )}
      </SectionCard>
    </div>
  );
}
