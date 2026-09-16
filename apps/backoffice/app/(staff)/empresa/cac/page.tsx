import { PageHeader } from "@repo/design-system/cosmos/kit";
import { lerCac } from "@/app/actions/empresa/cac";
import { secaoDaRota } from "@/components/nav";
import {
  intervaloPadraoCompetencia,
  lerIntervaloDaUrl,
} from "@/lib/empresa/periodo";
import { requirePlatformStaff } from "@/lib/guard";
import { Painel } from "./painel";

export const dynamic = "force-dynamic";

export default async function CacPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const { de, ate } = await searchParams;
  const intervalo = lerIntervaloDaUrl(
    { de, ate },
    intervaloPadraoCompetencia(new Date())
  );
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    lerCac(intervalo),
  ]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/empresa/cac")} · custo de aquisição`}
        subtitle="Cada parcela com a sua fonte. O resultado só aparece quando todas as linhas do período estiverem preenchidas — sem número, sem chute."
        title="CAC totalmente carregado"
      />
      {res.ok ? (
        // key no intervalo: o painel guarda estado em useState(inicial); sem remontar, trocar o período deixaria a tela velha.
        <Painel
          inicial={res.data}
          key={`${intervalo.de}:${intervalo.ate}`}
          podeEscrever={staff.canWrite}
        />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {res.error}
        </p>
      )}
    </div>
  );
}
