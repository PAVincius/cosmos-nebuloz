import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { listarAvaliacoes } from "@/app/actions/maturidade";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { requirePlatformStaff } from "@/lib/guard";
import { Lista } from "./lista";

/**
 * Growth · AI readiness — a carteira de diagnósticos de maturidade.
 *
 * A rubrica (seis dimensões, cinco níveis) mora em `lib/growth/maturidade.ts`.
 * Esta tela lista o que existe e abre um; responder é na rota do id.
 */
export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listarAvaliacoes(),
  ]);

  const cabecalho = (meta?: React.ReactNode) => (
    <PageHeader
      eyebrow="Growth · maturidade de IA"
      meta={meta}
      subtitle="Seis dimensões, cinco níveis. O diagnóstico é o degrau 01 da Escada — e é ele que diz por qual degrau o cliente entra."
      title="AI readiness"
      tone="purple"
    />
  );

  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {cabecalho()}
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar as avaliações"
        />
      </div>
    );
  }

  const { avaliacoes, totalDeCriterios } = res.data;
  const concluidas = avaliacoes.filter((a) => a.status === "CONCLUIDA");
  const comScore = concluidas.filter((a) => a.scoreGeral !== null);
  // Média só com o que tem número. Nenhuma concluída = "—", não zero: zero é
  // um diagnóstico péssimo, e "ainda não medimos" não é isso.
  const media =
    comScore.length === 0
      ? null
      : Math.round(
          comScore.reduce((t, a) => t + (a.scoreGeral ?? 0), 0) /
            comScore.length
        );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {cabecalho(
        <>
          <Badge tone="neutral">{avaliacoes.length} avaliações</Badge>
          {concluidas.length > 0 ? (
            <Badge tone="green">{concluidas.length} concluídas</Badge>
          ) : null}
          {media === null ? null : (
            <Badge tone="purple">score médio {media}</Badge>
          )}
        </>
      )}

      <Lista
        avaliacoes={avaliacoes}
        podeEscrever={staff.canWrite}
        totalDeCriterios={totalDeCriterios}
      />
    </div>
  );
}
