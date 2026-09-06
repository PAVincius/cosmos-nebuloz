import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { lerCaixa, lerDre } from "@/app/actions/empresa/financeiro";
import { requirePlatformStaff } from "@/lib/guard";
import { Caixa } from "./caixa";
import { Dre } from "./dre";

export const dynamic = "force-dynamic";

function mesCorrente(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; ate?: string }>;
}) {
  const { aba = "dre", ate } = await searchParams;
  const competenciaFinal = ate ?? mesCorrente();
  const [staff, dre, caixa] = await Promise.all([
    requirePlatformStaff(),
    aba === "dre" ? lerDre({ competenciaFinal }) : null,
    aba === "caixa" ? lerCaixa() : null,
  ]);
  const dreErro = dre !== null && !dre.ok ? dre.error : null;
  const caixaErro = caixa !== null && !caixa.ok ? caixa.error : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Empresa · Base financeira"
        subtitle="Uma frente de receita por produto, serviço separado de assinatura, e o caixa rolante de treze semanas. As linhas calculadas fecham sozinhas; as de entrada são suas."
        title="DRE e caixa"
      />
      <div style={{ display: "flex", gap: 6 }}>
        <Link
          href="/empresa/financeiro?aba=dre"
          style={abaStyle(aba === "dre")}
        >
          DRE mensal
        </Link>
        <Link
          href="/empresa/financeiro?aba=caixa"
          style={abaStyle(aba === "caixa")}
        >
          Caixa 13 semanas
        </Link>
      </div>
      {dreErro !== null ? (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {dreErro}
        </p>
      ) : null}
      {dre?.ok ? (
        // key na competência: o painel guarda estado em useState(inicial); sem remontar, trocar o período deixaria a tela velha.
        <Dre
          inicial={dre.data}
          key={competenciaFinal}
          podeEscrever={staff.canWrite}
        />
      ) : null}
      {caixaErro !== null ? (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {caixaErro}
        </p>
      ) : null}
      {caixa?.ok ? (
        <Caixa inicial={caixa.data} podeEscrever={staff.canWrite} />
      ) : null}
    </div>
  );
}
