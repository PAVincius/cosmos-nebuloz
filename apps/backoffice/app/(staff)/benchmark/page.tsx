import {
  KpiCard,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  type AgregadoDoBenchmark,
  agregadoDoBenchmark,
} from "@/app/actions/agregados";
import {
  type Benchmark,
  type ClienteBenchmark,
  listBenchmark,
  type ServicoBenchmark,
} from "@/app/actions/benchmark";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { PaginacaoEmLinks } from "@/components/paginacao-em-links";
import { Vazio } from "@/components/vazio";
import { formatarBRL } from "@/lib/comercial/formato";
import type { Result } from "@/lib/safe-action";

export const dynamic = "force-dynamic";

const LINK = { color: "var(--accent-text)", fontWeight: 700 } as const;

const CABECALHO = {
  padding: "0 10px 7px",
  textAlign: "left" as const,
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase" as const,
  color: "var(--ink-faint)",
};

const CELULA = {
  padding: "9px 10px",
  borderTop: "1px solid var(--hairline)",
  fontSize: "var(--fs-base)",
};

/**
 * Barra proporcional ao maior valor da coluna.
 *
 * Comparação entre clientes é sobre proporção, não sobre o número absoluto —
 * ler doze valores em centavos e descobrir quem pesa mais é trabalho que a
 * barra faz de relance.
 */
function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const pct = maximo === 0 ? 0 : Math.round((valor / maximo) * 100);
  return (
    <span
      style={{
        display: "block",
        height: 5,
        borderRadius: 99,
        background: "var(--surface-3)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          width: `${pct}%`,
          height: "100%",
          background: "var(--accent)",
        }}
      />
    </span>
  );
}

function LinhaCliente({ c, maximo }: { c: ClienteBenchmark; maximo: number }) {
  return (
    <tr>
      <td style={CELULA}>
        {/* O cliente citado é saída: comparar pede abrir quem pesa. */}
        <Link
          href={`/clientes/${c.slug}`}
          style={{ color: "var(--ink)", fontWeight: 600 }}
        >
          {c.nome}
        </Link>
        <span
          className="mono"
          style={{
            display: "block",
            fontSize: "var(--fs-micro)",
            color: "var(--ink-faint)",
          }}
        >
          {c.slug}
        </span>
      </td>
      <td className="mono" style={CELULA}>
        {c.engajamentos}
      </td>
      <td style={{ ...CELULA, minWidth: 140 }}>
        <span
          className="mono"
          style={{
            display: "block",
            marginBottom: 4,
            fontSize: "var(--fs-base)",
          }}
        >
          {formatarBRL(c.receitaCentavos)}
        </span>
        <Barra maximo={maximo} valor={c.receitaCentavos} />
      </td>
      <td className="mono" style={CELULA}>
        {formatarBRL(c.ticketCentavos)}
      </td>
      <td className="mono" style={CELULA}>
        {c.descontoMedio}%
      </td>
    </tr>
  );
}

function LinhaServico({ s, maximo }: { s: ServicoBenchmark; maximo: number }) {
  return (
    <tr>
      <td style={CELULA}>
        <span
          className="mono"
          style={{ fontWeight: 700, fontSize: "var(--fs-nota)" }}
        >
          {s.codigo}
        </span>
        <span style={{ marginLeft: 8 }}>{s.nome}</span>
      </td>
      <td className="mono" style={CELULA}>
        {s.engajamentos}
      </td>
      <td style={{ ...CELULA, minWidth: 140 }}>
        <span
          className="mono"
          style={{
            display: "block",
            marginBottom: 4,
            fontSize: "var(--fs-base)",
          }}
        >
          {formatarBRL(s.receitaCentavos)}
        </span>
        <Barra maximo={maximo} valor={s.receitaCentavos} />
      </td>
    </tr>
  );
}

/** Os KPIs são da carteira inteira (`actions/agregados.ts`). Somados sobre a
 *  página, "Clientes · na carteira" era o teto da lista. Sem a contagem,
 *  nenhum número — o da página seria dito como o da carteira. */
function Kpis({ agregado }: { agregado: Result<AgregadoDoBenchmark> }) {
  if (!agregado.ok) {
    return (
      <FalhaAoCarregar
        motivo={agregado.error}
        titulo="Não foi possível somar a carteira"
      />
    );
  }
  const { clientes, receitaCentavos, semContrato } = agregado.data;
  return (
    <div className="bo-kpis bo-kpis-3">
      <KpiCard
        hint="engajamentos que contam"
        icon="chart"
        label="Receita contratada"
        tone="green"
        value={formatarBRL(receitaCentavos)}
      />
      <KpiCard
        hint="na carteira"
        icon="building"
        label="Clientes"
        tone="blue"
        value={clientes}
      />
      <KpiCard
        hint="nenhum engajamento ainda"
        icon="alert"
        label="Sem contrato"
        tone={semContrato > 0 ? "amber" : "green"}
        value={semContrato}
      />
    </div>
  );
}

function Conteudo({
  dados,
  pagina,
  agregado,
}: {
  dados: Benchmark;
  pagina: number;
  agregado: Result<AgregadoDoBenchmark>;
}) {
  // Com mais de uma página, as tabelas descrevem os clientes desta — e as
  // legendas dizem isso, em vez de somar em silêncio o que não foi lido.
  const parcial = pagina > 1 || dados.temMaisClientes;
  const maxCliente = dados.clientes[0]?.receitaCentavos ?? 0;
  const maxServico = dados.servicos[0]?.receitaCentavos ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Kpis agregado={agregado} />

      <SectionCard
        as="h2"
        icon="building"
        subtitle={`maior receita primeiro · cancelado não entra na conta${parcial ? " · clientes desta página" : ""}`}
        title="Por cliente"
      >
        {dados.clientes.length === 0 ? (
          <Vazio>
            Nenhum cliente para comparar. O benchmark lê os engajamentos de{" "}
            <Link href="/delivery" style={LINK}>
              Delivery
            </Link>{" "}
            por cliente da carteira — sem cliente provisionado não há linha;
            cliente sem engajamento aparece com zero, para o achado não sumir.
          </Vazio>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="mono" scope="col" style={CABECALHO}>
                  Cliente
                </th>
                <th className="mono" scope="col" style={CABECALHO}>
                  Engaj.
                </th>
                <th className="mono" scope="col" style={CABECALHO}>
                  Receita
                </th>
                <th className="mono" scope="col" style={CABECALHO}>
                  Ticket médio
                </th>
                <th className="mono" scope="col" style={CABECALHO}>
                  Desconto médio
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.clientes.map((c) => (
                <LinhaCliente c={c} key={c.slug} maximo={maxCliente} />
              ))}
            </tbody>
          </table>
        )}
        <PaginacaoEmLinks
          caminho="/benchmark"
          pagina={pagina}
          temMais={dados.temMaisClientes}
        />
      </SectionCard>

      <SectionCard
        as="h2"
        icon="briefcase"
        subtitle={`o que o catálogo realmente vendeu${parcial ? " · aos clientes desta página" : ""}`}
        title="Por serviço"
      >
        {dados.servicos.length === 0 ? (
          <Vazio>
            Nenhum serviço no catálogo. Esta tabela cruza os engajamentos com o{" "}
            <Link href="/servicos" style={LINK}>
              catálogo de Serviços
            </Link>
            : cadastre o serviço lá e vincule-o ao criar o engajamento em
            Delivery — serviço sem venda aparece com zero.
          </Vazio>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="mono" scope="col" style={CABECALHO}>
                  Serviço
                </th>
                <th className="mono" scope="col" style={CABECALHO}>
                  Engaj.
                </th>
                <th className="mono" scope="col" style={CABECALHO}>
                  Receita
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.servicos.map((s) => (
                <LinhaServico key={s.codigo} maximo={maxServico} s={s} />
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

export const metadata = { title: tituloDaAba("/benchmark") };

/** `?pagina=` inválido ou ausente é a primeira. */
function paginaDaUrl(valor: string | undefined): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams?: Promise<{ pagina?: string }>;
} = {}) {
  const pagina = paginaDaUrl((await searchParams)?.pagina);
  const [res, agregado] = await Promise.all([
    listBenchmark({ pagina }),
    agregadoDoBenchmark(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/benchmark")} · comparação`}
        subtitle="Quem pesa mais na carteira e o que o catálogo realmente vendeu. Contrato cancelado e proposta recusada ficam de fora — incluí-los descreveria o que foi oferecido, não o que foi praticado."
        title="Benchmark"
      />
      {res.ok ? (
        <Conteudo agregado={agregado} dados={res.data} pagina={pagina} />
      ) : (
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar o benchmark"
        />
      )}
    </div>
  );
}
