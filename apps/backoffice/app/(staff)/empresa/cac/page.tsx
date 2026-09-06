import { PageHeader } from "@repo/design-system/cosmos/kit";
import { lerCac } from "@/app/actions/empresa/cac";
import { requirePlatformStaff } from "@/lib/guard";
import { Painel } from "./painel";

export const dynamic = "force-dynamic";

function mesCorrente(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CacPage({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string }>;
}) {
  const { competencia } = await searchParams;
  const alvo = competencia ?? mesCorrente();
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    lerCac({ competencia: alvo }),
  ]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · Custo de aquisição"
        subtitle="Cada parcela com a sua fonte. O resultado só aparece quando todas as linhas do período estiverem preenchidas — sem número, sem chute."
        title="CAC totalmente carregado"
      />
      {res.ok ? (
        // key na competência: o painel guarda estado em useState(inicial); sem remontar, trocar o período deixaria a tela velha.
        <Painel inicial={res.data} key={alvo} podeEscrever={staff.canWrite} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {res.error}
        </p>
      )}
    </div>
  );
}
