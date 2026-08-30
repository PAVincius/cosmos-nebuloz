import {
  KpiCard,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import {
  type Benchmark,
  type ClienteBenchmark,
  listBenchmark,
  type ServicoBenchmark,
} from "@/app/actions/benchmark";
import { formatarBRL } from "@/lib/comercial/formato";

export const dynamic = "force-dynamic";

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
        <span style={{ fontWeight: 600 }}>{c.nome}</span>
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

function Conteudo({ dados }: { dados: Benchmark }) {
  const maxCliente = dados.clientes[0]?.receitaCentavos ?? 0;
  const maxServico = dados.servicos[0]?.receitaCentavos ?? 0;
  const receita = dados.clientes.reduce((s, c) => s + c.receitaCentavos, 0);
  const semNada = dados.clientes.filter((c) => c.engajamentos === 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        }}
      >
        <KpiCard
          hint="engajamentos que contam"
          icon="chart"
          label="Receita contratada"
          tone="green"
          value={formatarBRL(receita)}
        />
        <KpiCard
          hint="na carteira"
          icon="building"
          label="Clientes"
          tone="blue"
          value={dados.clientes.length}
        />
        <KpiCard
          hint="nenhum engajamento ainda"
          icon="alert"
          label="Sem contrato"
          tone={semNada > 0 ? "amber" : "green"}
          value={semNada}
        />
      </div>

      <SectionCard
        icon="building"
        subtitle="maior receita primeiro · cancelado não entra na conta"
        title="Por cliente"
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="mono" style={CABECALHO}>
                Cliente
              </th>
              <th className="mono" style={CABECALHO}>
                Engaj.
              </th>
              <th className="mono" style={CABECALHO}>
                Receita
              </th>
              <th className="mono" style={CABECALHO}>
                Ticket médio
              </th>
              <th className="mono" style={CABECALHO}>
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
      </SectionCard>

      <SectionCard
        icon="briefcase"
        subtitle="o que o catálogo realmente vendeu"
        title="Por serviço"
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="mono" style={CABECALHO}>
                Serviço
              </th>
              <th className="mono" style={CABECALHO}>
                Engaj.
              </th>
              <th className="mono" style={CABECALHO}>
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
      </SectionCard>
    </div>
  );
}

export default async function BenchmarkPage() {
  const res = await listBenchmark();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · comparação"
        subtitle="Quem pesa mais na carteira e o que o catálogo realmente vendeu. Contrato cancelado e proposta recusada ficam de fora — incluí-los descreveria o que foi oferecido, não o que foi praticado."
        title="Benchmark"
      />
      {res.ok ? (
        <Conteudo dados={res.data} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {res.error}
        </p>
      )}
    </div>
  );
}
