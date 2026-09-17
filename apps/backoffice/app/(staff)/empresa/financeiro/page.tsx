import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  lerCaixa,
  lerDre,
  listarPlanoDeContas,
} from "@/app/actions/empresa/financeiro";
import { listarLancamentos } from "@/app/actions/empresa/livro";
import { lerOrcado } from "@/app/actions/empresa/orcamento";
import { listarRecorrente } from "@/app/actions/empresa/recorrente";
import { listarTitulos } from "@/app/actions/empresa/titulos";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { competenciaValida } from "@/lib/empresa/financeiro";
import {
  competenciaAtual,
  formatarDataBr,
  type Intervalo,
  intervaloPadraoCaixa,
  intervaloPadraoCompetencia,
  lerIntervaloDaUrl,
} from "@/lib/empresa/periodo";
import { requirePlatformStaff } from "@/lib/guard";
import { Caixa } from "./caixa";
import { Dre } from "./dre";
import { Lancamentos } from "./lancamentos";
import { Orcado } from "./orcado";
import { Plano } from "./plano";
import { Recorrente, SeletorCompetenciaRecorrente } from "./recorrente";
import { SeletorDaAba } from "./seletor";
import { Titulos } from "./titulos";

type Dados = {
  dre: Awaited<ReturnType<typeof lerDre>> | null;
  caixa: Awaited<ReturnType<typeof lerCaixa>> | null;
  plano: Awaited<ReturnType<typeof listarPlanoDeContas>> | null;
  lancamentos: Awaited<ReturnType<typeof listarLancamentos>> | null;
  titulos: Awaited<ReturnType<typeof listarTitulos>> | null;
  orcado: Awaited<ReturnType<typeof lerOrcado>> | null;
  recorrente: Awaited<ReturnType<typeof listarRecorrente>> | null;
};

/** Lê só o que a aba ativa precisa — as outras três leituras ficam `null` e
 *  nem chegam a bater no banco (spec 2026-09-06 §6, mesma ideia das abas
 *  anteriores). */
async function carregarDados(
  aba: Aba,
  intervalo: Intervalo,
  conta: string | undefined,
  competencia: string
): Promise<Dados> {
  const [dre, caixa, plano, lancamentos, titulos, orcado, recorrente] =
    await Promise.all([
      aba === "dre" ? lerDre(intervalo) : null,
      aba === "caixa" ? lerCaixa(intervalo) : null,
      aba === "plano" ? listarPlanoDeContas() : null,
      aba === "lancamentos"
        ? listarLancamentos({ ate: intervalo.ate, conta, de: intervalo.de })
        : null,
      // Sem intervalo: título é lista viva, não recorte de período (spec
      // 2026-09-06 §4) — é por isso que esta aba também não monta
      // `SeletorDaAba` logo abaixo, em `FinanceiroPage`.
      aba === "titulos" ? listarTitulos({}) : null,
      aba === "orcado"
        ? lerOrcado({ ate: intervalo.ate, de: intervalo.de })
        : null,
      // Também sem intervalo: esta aba olha um mês só (spec 2026-09-06 §4),
      // por isso o seletor próprio (`SeletorCompetenciaRecorrente`) em vez do
      // `SeletorDaAba` que move `de`/`ate`.
      aba === "recorrente" ? listarRecorrente({ competencia }) : null,
    ]);
  return { caixa, dre, lancamentos, orcado, plano, recorrente, titulos };
}

export const dynamic = "force-dynamic";

type Aba =
  | "dre"
  | "caixa"
  | "plano"
  | "lancamentos"
  | "titulos"
  | "orcado"
  | "recorrente";

function abaValida(aba: string | undefined): Aba {
  if (
    aba === "caixa" ||
    aba === "plano" ||
    aba === "lancamentos" ||
    aba === "titulos" ||
    aba === "orcado" ||
    aba === "recorrente"
  ) {
    return aba;
  }
  return "dre";
}

function abaStyle(ativa: boolean) {
  return {
    padding: "6px 12px",
    borderRadius: 99,
    fontSize: "var(--fs-nota)",
    fontWeight: 700,
    textDecoration: "none",
    color: "var(--ink)",
    background: ativa ? "var(--accent-soft)" : "var(--surface-2)",
    border: `1px solid ${ativa ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`,
  } as const;
}

/** O subtítulo menciona o período escolhido (spec 2026-09-06 §6) — as abas
 *  Plano e Títulos não têm intervalo (a segunda lê `listarTitulos({})` sem
 *  recorte nenhum, spec 2026-09-06 §4), então o texto muda por aba em vez de
 *  anunciar um "Período: …" que a tela não usa. */
function subtitleDaAba(
  aba: Aba,
  intervalo: Intervalo,
  competencia: string
): string {
  if (aba === "plano") {
    return "As 27 contas semeadas de docs/financeiro/plano-de-contas.md — código, nome, centro de custo e situação.";
  }
  if (aba === "titulos") {
    return "Compromissos a pagar e a receber — títulos em aberto, vencido, baixado ou cancelado. Lista viva, sem recorte de período.";
  }
  if (aba === "orcado") {
    return `Orçado por conta e competência, realizado somado do livro-razão, e o desvio entre os dois. Período: ${formatarDataBr(intervalo.de)} – ${formatarDataBr(intervalo.ate)}.`;
  }
  if (aba === "recorrente") {
    return `MRR, ARR, movimento do mês e franquia de créditos de IA — assinatura separada de serviço avulso. Competência: ${competencia}.`;
  }
  return `Uma frente de receita por produto, serviço separado de assinatura, e o caixa rolante. As linhas calculadas fecham sozinhas; as de entrada são suas. Período: ${formatarDataBr(intervalo.de)} – ${formatarDataBr(intervalo.ate)}.`;
}

function ErroDaAba({ erro }: { erro: string | null }) {
  if (erro === null) {
    return null;
  }
  return (
    <FalhaAoCarregar
      motivo={erro}
      titulo="Não foi possível carregar esta aba"
    />
  );
}

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "dre", rotulo: "DRE mensal" },
  { id: "lancamentos", rotulo: "Lançamentos" },
  { id: "titulos", rotulo: "Títulos" },
  { id: "orcado", rotulo: "Orçado × realizado" },
  { id: "recorrente", rotulo: "Receita recorrente" },
  { id: "caixa", rotulo: "Caixa" },
  { id: "plano", rotulo: "Plano de contas" },
];

/** Fora do JSX: inline, o lint lê o ternário como valor vazando. */
function ariaCurrent(ativa: boolean): "page" | undefined {
  return ativa ? "page" : undefined;
}

function Abas({ aba }: { aba: Aba }) {
  return (
    // `flexWrap`: sete abas não cabem numa linha de 720px, e sem quebra a
    // última saía do cartão. `aria-current` é o que diz ao leitor de tela
    // qual está aberta — a cor de fundo só diz a quem enxerga.
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {ABAS.map((a) => (
        <Link
          aria-current={ariaCurrent(aba === a.id)}
          href={`/empresa/financeiro?aba=${a.id}`}
          key={a.id}
          style={abaStyle(aba === a.id)}
        >
          {a.rotulo}
        </Link>
      ))}
    </div>
  );
}

/** Erro + painel de uma leitura, um componente por aba — cada um trivial
 *  (resultado `null` ou `{ok}`), para a complexidade cognitiva não se
 *  acumular num `PainelDaAba` só (ponytail D1: o teto do lint estourava com
 *  os cinco casos num corpo só; extraído de volta em funções pequenas, mas
 *  agora `PainelDaAba` despacha para a única que a aba pede, em vez de
 *  chamar as cinco sabendo que quatro devolvem null). */
function PainelDre({
  resultado,
  chaveDoPainel,
}: {
  resultado: Dados["dre"];
  chaveDoPainel: string;
}) {
  if (resultado === null) {
    return null;
  }
  return (
    <>
      <ErroDaAba erro={resultado.ok ? null : resultado.error} />
      {/* key no intervalo: o painel guarda estado em useState(inicial); sem remontar, trocar o período deixaria a tela velha. */}
      {resultado.ok ? (
        <Dre inicial={resultado.data} key={chaveDoPainel} />
      ) : null}
    </>
  );
}

function PainelCaixa({
  resultado,
  chaveDoPainel,
  podeEscrever,
}: {
  resultado: Dados["caixa"];
  chaveDoPainel: string;
  podeEscrever: boolean;
}) {
  if (resultado === null) {
    return null;
  }
  return (
    <>
      <ErroDaAba erro={resultado.ok ? null : resultado.error} />
      {resultado.ok ? (
        <Caixa
          inicial={resultado.data}
          key={chaveDoPainel}
          podeEscrever={podeEscrever}
        />
      ) : null}
    </>
  );
}

function PainelPlano({
  resultado,
  chaveDoPainel,
  podeEscrever,
}: {
  resultado: Dados["plano"];
  chaveDoPainel: string;
  podeEscrever: boolean;
}) {
  if (resultado === null) {
    return null;
  }
  return (
    <>
      <ErroDaAba erro={resultado.ok ? null : resultado.error} />
      {resultado.ok ? (
        <Plano
          inicial={resultado.data}
          key={chaveDoPainel}
          podeEscrever={podeEscrever}
        />
      ) : null}
    </>
  );
}

function PainelLancamentos({
  resultado,
  intervalo,
  contaFiltro,
  chaveDoPainel,
  podeEscrever,
}: {
  resultado: Dados["lancamentos"];
  intervalo: Intervalo;
  contaFiltro: string | null;
  chaveDoPainel: string;
  podeEscrever: boolean;
}) {
  if (resultado === null) {
    return null;
  }
  return (
    <>
      <ErroDaAba erro={resultado.ok ? null : resultado.error} />
      {resultado.ok ? (
        <Lancamentos
          contaFiltro={contaFiltro}
          inicial={resultado.data}
          intervalo={intervalo}
          key={chaveDoPainel}
          podeEscrever={podeEscrever}
        />
      ) : null}
    </>
  );
}

function PainelTitulos({
  resultado,
  chaveDoPainel,
  podeEscrever,
}: {
  resultado: Dados["titulos"];
  chaveDoPainel: string;
  podeEscrever: boolean;
}) {
  if (resultado === null) {
    return null;
  }
  return (
    <>
      <ErroDaAba erro={resultado.ok ? null : resultado.error} />
      {resultado.ok ? (
        <Titulos
          inicial={resultado.data}
          key={chaveDoPainel}
          podeEscrever={podeEscrever}
        />
      ) : null}
    </>
  );
}

function PainelOrcado({
  resultado,
  intervalo,
  chaveDoPainel,
  podeEscrever,
}: {
  resultado: Dados["orcado"];
  intervalo: Intervalo;
  chaveDoPainel: string;
  podeEscrever: boolean;
}) {
  if (resultado === null) {
    return null;
  }
  return (
    <>
      <ErroDaAba erro={resultado.ok ? null : resultado.error} />
      {resultado.ok ? (
        <Orcado
          inicial={resultado.data}
          intervalo={intervalo}
          key={chaveDoPainel}
          podeEscrever={podeEscrever}
        />
      ) : null}
    </>
  );
}

function PainelRecorrente({
  resultado,
  competencia,
  chaveDoPainel,
  podeEscrever,
}: {
  resultado: Dados["recorrente"];
  competencia: string;
  chaveDoPainel: string;
  podeEscrever: boolean;
}) {
  if (resultado === null) {
    return null;
  }
  return (
    <>
      <ErroDaAba erro={resultado.ok ? null : resultado.error} />
      {resultado.ok ? (
        <Recorrente
          competencia={competencia}
          inicial={resultado.data}
          key={chaveDoPainel}
          podeEscrever={podeEscrever}
        />
      ) : null}
    </>
  );
}

/** Corpo da aba ativa: um `switch` que devolve só o painel vivo, em vez de
 *  chamar os cinco sabendo que quatro são nulos (spec 2026-09-06 §6). */
function PainelDaAba({
  aba,
  dados,
  intervalo,
  conta,
  competencia,
  chaveDoPainel,
  podeEscrever,
}: {
  aba: Aba;
  dados: Dados;
  intervalo: Intervalo;
  conta: string | undefined;
  competencia: string;
  chaveDoPainel: string;
  podeEscrever: boolean;
}) {
  switch (aba) {
    case "dre":
      return <PainelDre chaveDoPainel={chaveDoPainel} resultado={dados.dre} />;
    case "caixa":
      return (
        <PainelCaixa
          chaveDoPainel={chaveDoPainel}
          podeEscrever={podeEscrever}
          resultado={dados.caixa}
        />
      );
    case "plano":
      return (
        <PainelPlano
          chaveDoPainel={chaveDoPainel}
          podeEscrever={podeEscrever}
          resultado={dados.plano}
        />
      );
    case "lancamentos":
      return (
        <PainelLancamentos
          chaveDoPainel={chaveDoPainel}
          contaFiltro={conta ?? null}
          intervalo={intervalo}
          podeEscrever={podeEscrever}
          resultado={dados.lancamentos}
        />
      );
    case "titulos":
      return (
        <PainelTitulos
          chaveDoPainel={chaveDoPainel}
          podeEscrever={podeEscrever}
          resultado={dados.titulos}
        />
      );
    case "orcado":
      return (
        <PainelOrcado
          chaveDoPainel={chaveDoPainel}
          intervalo={intervalo}
          podeEscrever={podeEscrever}
          resultado={dados.orcado}
        />
      );
    case "recorrente":
      return (
        <PainelRecorrente
          chaveDoPainel={chaveDoPainel}
          competencia={competencia}
          podeEscrever={podeEscrever}
          resultado={dados.recorrente}
        />
      );
    default:
      return null;
  }
}

/** O controle de período no cabeçalho: `SeletorDaAba` (intervalo) para as
 *  abas que recortam por período, o seletor de competência única para
 *  Receita recorrente, e nenhum para Plano/Títulos — que são listas vivas. */
function SeletorDaPagina({
  aba,
  intervalo,
  competencia,
  extraDoSeletor,
}: {
  aba: Aba;
  intervalo: Intervalo;
  competencia: string;
  extraDoSeletor: Record<string, string> | undefined;
}) {
  if (aba === "plano" || aba === "titulos") {
    return null;
  }
  if (aba === "recorrente") {
    return <SeletorCompetenciaRecorrente competencia={competencia} />;
  }
  return <SeletorDaAba aba={aba} extra={extraDoSeletor} valor={intervalo} />;
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    de?: string;
    ate?: string;
    conta?: string;
    competencia?: string;
  }>;
}) {
  const {
    aba: abaParam,
    de,
    ate,
    conta,
    competencia: competenciaParam,
  } = await searchParams;
  const aba = abaValida(abaParam);
  const hoje = new Date();
  const padrao =
    aba === "caixa"
      ? intervaloPadraoCaixa(hoje)
      : intervaloPadraoCompetencia(hoje);
  const intervalo = lerIntervaloDaUrl({ de, ate }, padrao);
  const competencia =
    typeof competenciaParam === "string" && competenciaValida(competenciaParam)
      ? competenciaParam
      : competenciaAtual();

  const [staff, dados] = await Promise.all([
    requirePlatformStaff(),
    carregarDados(aba, intervalo, conta, competencia),
  ]);
  // `conta` entra na chave: duas células do DRE na mesma competência mas em
  // contas diferentes têm o mesmo `de`/`ate` — sem `conta` aqui, trocar de
  // conta não remontaria o painel e `useState(inicial)` ficaria com os dados
  // da conta anterior. `competencia` entra do mesmo jeito, só para a aba
  // Receita recorrente — nas outras abas ela não muda o que a página lê.
  const chaveDoPainel = `${aba}:${intervalo.de}:${intervalo.ate}:${conta ?? ""}:${aba === "recorrente" ? competencia : ""}`;
  // `extra` só existe na aba Lançamentos com `conta` na URL — o `&&` mora
  // fora do JSX para o noLeakedRender não confundir a condição com a marcação
  // que ela protege.
  const contaNaUrl = aba === "lancamentos" ? conta : undefined;
  const extraDoSeletor = contaNaUrl ? { conta: contaNaUrl } : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Empresa · Base financeira"
        subtitle={subtitleDaAba(aba, intervalo, competencia)}
        title="Financeiro"
      />
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <Abas aba={aba} />
        <SeletorDaPagina
          aba={aba}
          competencia={competencia}
          extraDoSeletor={extraDoSeletor}
          intervalo={intervalo}
        />
      </div>
      <PainelDaAba
        aba={aba}
        chaveDoPainel={chaveDoPainel}
        competencia={competencia}
        conta={conta}
        dados={dados}
        intervalo={intervalo}
        podeEscrever={staff.canWrite}
      />
    </div>
  );
}
