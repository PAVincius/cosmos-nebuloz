import {
  Badge,
  KpiCard,
  PageHeader,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { type ContaComSaude, listAccountHealth } from "@/app/actions/accounts";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { PaginacaoEmLinks } from "@/components/paginacao-em-links";
import { Vazio } from "@/components/vazio";
import {
  DIAS_PARA_RENOVACAO,
  DIAS_SEM_ATIVIDADE,
  ROTULO_SAUDE,
  type Saude,
} from "@/lib/health";

export const dynamic = "force-dynamic";

const TOM: Record<Saude, Tone> = {
  RISCO: "red",
  ATENCAO: "amber",
  SEM_SINAL: "neutral",
  OK: "green",
};

function quandoRenova(c: ContaComSaude): string {
  if (c.diasParaRenovar === null) {
    return "sem data de renovação";
  }
  if (c.diasParaRenovar < 0) {
    return `venceu há ${Math.abs(c.diasParaRenovar)}d`;
  }
  return `em ${c.diasParaRenovar}d`;
}

function Conta({ c, primeira }: { c: ContaComSaude; primeira: boolean }) {
  return (
    <li
      style={{
        padding: "13px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Badge dot tone={TOM[c.saude]}>
          {ROTULO_SAUDE[c.saude]}
        </Badge>
        <Link
          href={`/clientes/${c.slug}`}
          style={{
            flex: 1,
            minWidth: 140,
            color: "var(--ink)",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: "var(--fs-base)",
              fontWeight: 600,
            }}
          >
            {c.nome}
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {c.slug} · {c.plano}
          </span>
        </Link>
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-nota)",
            color:
              c.diasParaRenovar !== null && c.diasParaRenovar < 0
                ? "var(--red-text)"
                : "var(--ink-muted)",
          }}
        >
          {quandoRenova(c)}
        </span>
        <span
          className="mono"
          style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
        >
          {c.ultimaAtividade
            ? `ativo em ${new Date(c.ultimaAtividade).toLocaleDateString("pt-BR")}`
            : "sem atividade registrada"}
        </span>
      </div>

      {/* Cada veredito carrega o motivo. Badge vermelho sem razão não diz a
          ninguém o que fazer em seguida. */}
      {c.sinais.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: "8px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {c.sinais.map((s) => (
            <li
              key={s.texto}
              style={{
                fontSize: "var(--fs-nota)",
                color:
                  s.nivel === "RISCO" ? "var(--red-text)" : "var(--amber-text)",
              }}
            >
              {/* O nível em palavra, além da cor: vermelho e âmbar são iguais
                  para quem não distingue os dois. */}
              <strong>{s.nivel === "RISCO" ? "Crítico" : "Atenção"}</strong> ·{" "}
              {s.texto}
            </li>
          ))}
        </ul>
      ) : null}

      {c.saude === "SEM_SINAL" ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
          }}
        >
          Nenhum módulo contratado — não há sinal sobre esta conta. Isso não é o
          mesmo que estar saudável.
        </p>
      ) : null}
    </li>
  );
}

function Conteudo({
  contas,
  pagina,
  temMais,
}: {
  contas: ContaComSaude[];
  pagina: number;
  temMais: boolean;
}) {
  const risco = contas.filter((c) => c.saude === "RISCO").length;
  const atencao = contas.filter((c) => c.saude === "ATENCAO").length;
  const semSinal = contas.filter((c) => c.saude === "SEM_SINAL").length;
  const renovando = contas.filter(
    (c) =>
      c.diasParaRenovar !== null && c.diasParaRenovar <= DIAS_PARA_RENOVACAO
  ).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="bo-kpis">
        <KpiCard
          hint="módulo suspenso, cancelado ou renovação vencida"
          icon="alert"
          label="Em risco"
          tone={risco > 0 ? "red" : "green"}
          value={risco}
        />
        <KpiCard
          hint="algo para acompanhar"
          icon="eye"
          label="Atenção"
          tone={atencao > 0 ? "amber" : "green"}
          value={atencao}
        />
        <KpiCard
          hint={`nos próximos ${DIAS_PARA_RENOVACAO} dias`}
          icon="clock"
          label="Renovando"
          tone="blue"
          value={renovando}
        />
        <KpiCard
          hint="sem módulo contratado"
          icon="ban"
          label="Sem sinal"
          tone={semSinal > 0 ? "amber" : "green"}
          value={semSinal}
        />
      </div>

      <SectionCard
        as="h2"
        icon="heart"
        subtitle="pior primeiro · saúde derivada do que a plataforma já grava"
        title="Contas"
      >
        {contas.length === 0 ? (
          <Vazio>Nenhum cliente na carteira ainda.</Vazio>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {contas.map((c, i) => (
              <Conta c={c} key={c.slug} primeira={i === 0} />
            ))}
          </ul>
        )}
        <PaginacaoEmLinks caminho="/contas" pagina={pagina} temMais={temMais} />
      </SectionCard>
    </div>
  );
}

export const metadata = { title: tituloDaAba("/contas") };

/** `?pagina=` inválido ou ausente é a primeira. */
function paginaDaUrl(valor: string | undefined): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export default async function ContasPage({
  searchParams,
}: {
  searchParams?: Promise<{ pagina?: string }>;
} = {}) {
  const pagina = paginaDaUrl((await searchParams)?.pagina);
  const res = await listAccountHealth(undefined, { pagina });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/contas")} · carteira`}
        subtitle={`Saúde derivada do que a plataforma já grava: status de módulo, renovação, integração com erro e silêncio de mais de ${DIAS_SEM_ATIVIDADE} dias. Não há campo marcado à mão — ele envelheceria sem ninguém perceber.`}
        title="Saúde e renovação"
      />
      {res.ok ? (
        <Conteudo
          contas={res.data.itens}
          pagina={pagina}
          temMais={res.data.temMais}
        />
      ) : (
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar a saúde das contas"
        />
      )}
    </div>
  );
}
