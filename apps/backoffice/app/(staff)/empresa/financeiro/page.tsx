import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  lerCaixa,
  lerDre,
  listarPlanoDeContas,
} from "@/app/actions/empresa/financeiro";
import { listarLancamentos } from "@/app/actions/empresa/livro";
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
import { Plano } from "./plano";
import { SeletorDaAba } from "./seletor";
import { Titulos } from "./titulos";

type Dados = {
  dre: Awaited<ReturnType<typeof lerDre>> | null;
  caixa: Awaited<ReturnType<typeof lerCaixa>> | null;
  plano: Awaited<ReturnType<typeof listarPlanoDeContas>> | null;
  lancamentos: Awaited<ReturnType<typeof listarLancamentos>> | null;
  titulos: Awaited<ReturnType<typeof listarTitulos>> | null;
};

/** Lê só o que a aba ativa precisa — as outras três leituras ficam `null` e
 *  nem chegam a bater no banco (spec 2026-09-06 §6, mesma ideia das abas
 *  anteriores). */
async function carregarDados(
  aba: Aba,
  intervalo: Intervalo,
  conta: string | undefined
): Promise<Dados> {
  const [dre, caixa, plano, lancamentos, titulos] = await Promise.all([
    aba === "dre" ? lerDre(intervalo) : null,
    aba === "caixa" ? lerCaixa(intervalo) : null,
    aba === "plano" ? listarPlanoDeContas() : null,
    aba === "lancamentos"
      ? listarLancamentos({ ate: intervalo.ate, conta, de: intervalo.de })
      : null,
    // Sem intervalo: título é lista viva, não recorte de período (spec
    // 2026-09-06 §4) — é por isso que esta aba também não monta `SeletorDaAba`
    // logo abaixo, em `FinanceiroPage`.
    aba === "titulos" ? listarTitulos({}) : null,
  ]);
  return { caixa, dre, lancamentos, plano, titulos };
}

export const dynamic = "force-dynamic";

type Aba = "dre" | "caixa" | "plano" | "lancamentos" | "titulos";

function abaValida(aba: string | undefined): Aba {
  if (
    aba === "caixa" ||
    aba === "plano" ||
    aba === "lancamentos" ||
    aba === "titulos"
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

/** O subtítulo menciona o período escolhido (spec 2026-09-06 §6) — a aba
 *  Plano não tem intervalo, então o texto muda por aba. */
function subtitleDaAba(aba: Aba, intervalo: Intervalo): string {
  if (aba === "plano") {
    return "As 27 contas semeadas de docs/financeiro/plano-de-contas.md — código, nome, centro de custo e situação.";
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
 *  acumular numa `PainelDaAba` só (era o que estourava o teto do lint ao
 *  crescer uma leitura por task). */
function PainelDre({
  resultado,
  chaveDoPainel,
  podeEscrever,
}: {
  resultado: Dados["dre"];
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
        // key no intervalo: o painel guarda estado em useState(inicial); sem remontar, trocar o período deixaria a tela velha.
        <Dre
          inicial={resultado.data}
          key={chaveDoPainel}
          podeEscrever={podeEscrever}
        />
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

/** Corpo da aba ativa: só chama os cinco painéis, um por leitura — cada um
 *  decide sozinho se tem algo para mostrar (spec 2026-09-06 §6). */
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
  return (
    <>
      <PainelDre
        chaveDoPainel={chaveDoPainel}
        podeEscrever={podeEscrever}
        resultado={dados.dre}
      />
      <PainelCaixa
        chaveDoPainel={chaveDoPainel}
        podeEscrever={podeEscrever}
        resultado={dados.caixa}
      />
      <PainelPlano
        chaveDoPainel={chaveDoPainel}
        podeEscrever={podeEscrever}
        resultado={dados.plano}
      />
      <PainelLancamentos
        chaveDoPainel={chaveDoPainel}
        contaFiltro={aba === "lancamentos" ? (conta ?? null) : null}
        intervalo={intervalo}
        podeEscrever={podeEscrever}
        resultado={dados.lancamentos}
      />
      <PainelTitulos
        chaveDoPainel={chaveDoPainel}
        podeEscrever={podeEscrever}
        resultado={dados.titulos}
      />
    </>
  );
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
