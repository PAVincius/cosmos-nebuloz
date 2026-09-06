import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  lerCaixa,
  lerDre,
  listarPlanoDeContas,
} from "@/app/actions/empresa/financeiro";
import {
  formatarDataBr,
  type Intervalo,
  intervaloPadraoCaixa,
  intervaloPadraoCompetencia,
  lerIntervaloDaUrl,
  PRESETS_CAIXA,
  PRESETS_COMPETENCIA,
} from "@/lib/empresa/periodo";
import { requirePlatformStaff } from "@/lib/guard";
import { Caixa } from "./caixa";
import { Dre } from "./dre";
import { Plano } from "./plano";
import { SeletorDaAba } from "./seletor";

export const dynamic = "force-dynamic";

type Aba = "dre" | "caixa" | "plano";

function abaValida(aba: string | undefined): Aba {
  if (aba === "caixa" || aba === "plano") {
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
        href="/empresa/financeiro?aba=caixa"
        style={abaStyle(aba === "caixa")}
      >
        Caixa 13 semanas
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

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; de?: string; ate?: string }>;
}) {
  const { aba: abaParam, de, ate } = await searchParams;
  const aba = abaValida(abaParam);
  const hoje = new Date();
  const padrao =
    aba === "caixa"
      ? intervaloPadraoCaixa(hoje)
      : intervaloPadraoCompetencia(hoje);
  const intervalo = lerIntervaloDaUrl({ de, ate }, padrao);

  const [staff, dre, caixa, plano] = await Promise.all([
    requirePlatformStaff(),
    aba === "dre" ? lerDre(intervalo) : null,
    aba === "caixa" ? lerCaixa(intervalo) : null,
    aba === "plano" ? listarPlanoDeContas() : null,
  ]);
  const chaveDoPainel = `${aba}:${intervalo.de}:${intervalo.ate}`;
  const presets = aba === "caixa" ? PRESETS_CAIXA : PRESETS_COMPETENCIA;

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
        {aba === "plano" ? null : (
          <SeletorDaAba aba={aba} presets={presets} valor={intervalo} />
        )}
      </div>
      <ErroDaAba erro={dre !== null && !dre.ok ? dre.error : null} />
      {dre?.ok ? (
        // key no intervalo: o painel guarda estado em useState(inicial); sem remontar, trocar o período deixaria a tela velha.
        <Dre
          inicial={dre.data}
          key={chaveDoPainel}
          podeEscrever={staff.canWrite}
        />
      ) : null}
      <ErroDaAba erro={caixa !== null && !caixa.ok ? caixa.error : null} />
      {caixa?.ok ? (
        <Caixa
          inicial={caixa.data}
          key={chaveDoPainel}
          podeEscrever={staff.canWrite}
        />
      ) : null}
      <ErroDaAba erro={plano !== null && !plano.ok ? plano.error : null} />
      {plano?.ok ? (
        <Plano
          inicial={plano.data}
          key={chaveDoPainel}
          podeEscrever={staff.canWrite}
        />
      ) : null}
    </div>
  );
}
