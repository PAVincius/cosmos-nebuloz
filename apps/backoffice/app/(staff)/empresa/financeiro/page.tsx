import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  lerCaixa,
  lerDre,
  listarPlanoDeContas,
} from "@/app/actions/empresa/financeiro";
import { listarLancamentos } from "@/app/actions/empresa/livro";
import { lerOrcado } from "@/app/actions/empresa/orcamento";
import { listarTitulos } from "@/app/actions/empresa/titulos";
import {
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
import { SeletorDaAba } from "./seletor";
import { Titulos } from "./titulos";

type Dados = {
  dre: Awaited<ReturnType<typeof lerDre>> | null;
  caixa: Awaited<ReturnType<typeof lerCaixa>> | null;
  plano: Awaited<ReturnType<typeof listarPlanoDeContas>> | null;
  lancamentos: Awaited<ReturnType<typeof listarLancamentos>> | null;
  titulos: Awaited<ReturnType<typeof listarTitulos>> | null;
  orcado: Awaited<ReturnType<typeof lerOrcado>> | null;
};

/** Lê só o que a aba ativa precisa — as outras três leituras ficam `null` e
 *  nem chegam a bater no banco (spec 2026-09-06 §6, mesma ideia das abas
 *  anteriores). */
async function carregarDados(
  aba: Aba,
  intervalo: Intervalo,
  conta: string | undefined
): Promise<Dados> {
  const [dre, caixa, plano, lancamentos, titulos, orcado] = await Promise.all([
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
  ]);
  return { caixa, dre, lancamentos, orcado, plano, titulos };
}

export const dynamic = "force-dynamic";

type Aba = "dre" | "caixa" | "plano" | "lancamentos" | "titulos" | "orcado";

function abaValida(aba: string | undefined): Aba {
  if (
    aba === "caixa" ||
    aba === "plano" ||
    aba === "lancamentos" ||
    aba === "titulos" ||
    aba === "orcado"
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
function subtitleDaAba(aba: Aba, intervalo: Intervalo): string {
  if (aba === "plano") {
    return "As 27 contas semeadas de docs/financeiro/plano-de-contas.md — código, nome, centro de custo e situação.";
  }
  if (aba === "titulos") {
    return "Compromissos a pagar e a receber — títulos em aberto, vencido, baixado ou cancelado. Lista viva, sem recorte de período.";
  }
  if (aba === "orcado") {
    return `Orçado por conta e competência, realizado somado do livro-razão, e o desvio entre os dois. Período: ${formatarDataBr(intervalo.de)} – ${formatarDataBr(intervalo.ate)}.`;
  }
  return `Uma frente de receita por produto, serviço separado de assinatura, e o caixa rolante. As linhas calculadas fecham sozinhas; as de entrada são suas. Período: ${formatarDataBr(intervalo.de)} – ${formatarDataBr(intervalo.ate)}.`;
}

function ErroDaAba({ erro }: { erro: string | null }) {
  if (erro === null) {
    return null;
  }
  return (
    <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
      {erro}
    </p>
  );
}

function Abas({ aba }: { aba: Aba }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Link href="/empresa/financeiro?aba=dre" style={abaStyle(aba === "dre")}>
        DRE mensal
      </Link>
      <Link
        href="/empresa/financeiro?aba=lancamentos"
        style={abaStyle(aba === "lancamentos")}
      >
        Lançamentos
      </Link>
      <Link
        href="/empresa/financeiro?aba=titulos"
        style={abaStyle(aba === "titulos")}
      >
        Títulos
      </Link>
      <Link
        href="/empresa/financeiro?aba=orcado"
        style={abaStyle(aba === "orcado")}
      >
        Orçado × realizado
      </Link>
      <Link
        href="/empresa/financeiro?aba=caixa"
        style={abaStyle(aba === "caixa")}
      >
        Caixa
      </Link>
      <Link
        href="/empresa/financeiro?aba=plano"
        style={abaStyle(aba === "plano")}
      >
        Plano de contas
      </Link>
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

/** Corpo da aba ativa: um `switch` que devolve só o painel vivo, em vez de
 *  chamar os cinco sabendo que quatro são nulos (spec 2026-09-06 §6). */
function PainelDaAba({
  aba,
  dados,
  intervalo,
  conta,
  chaveDoPainel,
  podeEscrever,
}: {
  aba: Aba;
  dados: Dados;
  intervalo: Intervalo;
  conta: string | undefined;
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
    default:
      return null;
  }
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    de?: string;
    ate?: string;
    conta?: string;
  }>;
}) {
  const { aba: abaParam, de, ate, conta } = await searchParams;
  const aba = abaValida(abaParam);
  const hoje = new Date();
  const padrao =
    aba === "caixa"
      ? intervaloPadraoCaixa(hoje)
      : intervaloPadraoCompetencia(hoje);
  const intervalo = lerIntervaloDaUrl({ de, ate }, padrao);

  const [staff, dados] = await Promise.all([
    requirePlatformStaff(),
    carregarDados(aba, intervalo, conta),
  ]);
  // `conta` entra na chave: duas células do DRE na mesma competência mas em
  // contas diferentes têm o mesmo `de`/`ate` — sem `conta` aqui, trocar de
  // conta não remontaria o painel e `useState(inicial)` ficaria com os dados
  // da conta anterior.
  const chaveDoPainel = `${aba}:${intervalo.de}:${intervalo.ate}:${conta ?? ""}`;
  // `extra` só existe na aba Lançamentos com `conta` na URL — o `&&` mora
  // fora do JSX para o noLeakedRender não confundir a condição com a marcação
  // que ela protege.
  const contaNaUrl = aba === "lancamentos" ? conta : undefined;
  const extraDoSeletor = contaNaUrl ? { conta: contaNaUrl } : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Empresa · Base financeira"
        subtitle={subtitleDaAba(aba, intervalo)}
        title="DRE e caixa"
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
        {aba === "plano" || aba === "titulos" ? null : (
          <SeletorDaAba aba={aba} extra={extraDoSeletor} valor={intervalo} />
        )}
      </div>
      <PainelDaAba
        aba={aba}
        chaveDoPainel={chaveDoPainel}
        conta={conta}
        dados={dados}
        intervalo={intervalo}
        podeEscrever={staff.canWrite}
      />
    </div>
  );
}
