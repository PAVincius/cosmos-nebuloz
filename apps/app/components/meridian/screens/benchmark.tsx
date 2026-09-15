"use client";

// Benchmark pool — US6. Port de `meridian-screens-3.jsx`.
//
// O limiar de leitura é aplicado na action (`readCohort`): a linha retida chega
// aqui **sem** os percentis. Esta tela não "esconde" número — ela não os tem.

import {
  Badge,
  KpiCard,
  PageHeader,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useCallback } from "react";
import {
  type CohortRow,
  listCohorts,
} from "@/app/(meridian)/actions/benchmark";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { BENCH_THRESHOLD } from "@/lib/meridian/benchmark";
import {
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  TableHead,
  TableRow,
  useMeridianData,
} from "../base";

const COLS = "1.4fr 80px 1.8fr 160px";

export default function BenchmarkScreen() {
  const fetcher = useCallback(() => listCohorts(), []);
  const { data, loading, error, reload } =
    useMeridianData<CohortRow[]>(fetcher);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const rows = data ?? [];
  const available = rows.filter((c) => !c.withheld).length;
  const withheld = rows.length - available;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Diagnose · dado agregado"
        subtitle={`Contribuições anônimas de organizações com opt-in. Threshold de leitura: n ≥ ${BENCH_THRESHOLD} — abaixo disso, retido.`}
        title="Benchmark pool"
        tone="accent"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            <KpiCard
              hint={`${available} acima do threshold`}
              icon="building"
              label="Coortes no pool"
              tone="accent"
              value={rows.length}
            />
            <KpiCard
              hint="somente com opt-in explícito"
              icon="check"
              label="Organizações contribuindo"
              tone="green"
              value={rows.reduce((sum, c) => sum + c.n, 0)}
            />
            <KpiCard
              hint={`n abaixo de ${BENCH_THRESHOLD}`}
              icon="ban"
              label="Coortes retidas"
              tone="amber"
              value={withheld}
            />
          </>
        )}
      </div>

      <SectionCard
        bodyStyle={{ padding: 0 }}
        icon="activity"
        subtitle="cohort_key = setor × faixa de tamanho · agregado recalculado a cada contribuição"
        title="Coortes"
      >
        {loading ? (
          <div style={{ padding: 16 }}>
            <SkeletonCard />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24 }}>
            <SmartEmptyState
              icon="activity"
              subtitle="Nenhuma organização com opt-in contribuiu ainda. O pool nasce do primeiro scoring finalizado com consentimento."
              title="Pool vazio"
              tone="accent"
            />
          </div>
        ) : (
          <>
            <TableHead
              cols={COLS}
              labels={[
                "Coorte",
                "n",
                "Mediana por eixo (p50)",
                { t: "Leitura", align: "right" },
              ]}
            />
            {rows.map((c, i) => (
              <TableRow
                cols={COLS}
                key={c.cohortKey}
                last={i === rows.length - 1}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11.5, fontWeight: 700 }}
                >
                  {c.cohortKey}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: c.withheld
                      ? "var(--amber-text)"
                      : "var(--green-text)",
                  }}
                >
                  {c.n}
                </span>
                {c.withheld ? (
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-faint)",
                      fontWeight: 500,
                    }}
                  >
                    agregado existe, leitura bloqueada
                  </span>
                ) : (
                  // Barra com o número embaixo. Só a barra, em 24px de altura,
                  // punha medianas de 47 e 64 a 4px uma da outra — cinco
                  // quadrados iguais que não diziam nada. O número é a
                  // leitura; a barra é o relance.
                  <span
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-end",
                    }}
                  >
                    {AXIS_IDS.map((x) => (
                      <span
                        className="chart-hit"
                        key={x}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 3,
                          width: 22,
                        }}
                        title={`${AXES[x].label}: p50 ${c.bands[x].p50}`}
                      >
                        <span
                          style={{
                            width: 12,
                            height: Math.max(3, (c.bands[x].p50 / 100) * 28),
                            borderRadius: 2,
                            background: "var(--accent)",
                            opacity: 0.75,
                          }}
                        />
                        <span
                          className="mono"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--ink-muted)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {c.bands[x].p50}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
                <span style={{ display: "flex", justifyContent: "flex-end" }}>
                  {c.withheld ? (
                    <Badge dot tone="amber">
                      retido · n &lt; {BENCH_THRESHOLD}
                    </Badge>
                  ) : (
                    <Badge dot tone="green">
                      disponível
                    </Badge>
                  )}
                </span>
              </TableRow>
            ))}
          </>
        )}
      </SectionCard>

      <SectionCard
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 8 }}
        icon="shield"
        title="Regras do pool"
        tone="accent"
      >
        {[
          "Contribuição só acontece com opt-in de benchmark ativo no assessment.",
          "O threshold é aplicado na leitura — o agregado existe, mas não sai da action abaixo do mínimo.",
          "Nenhuma organização é identificável: só setor, faixa de tamanho e percentis por coorte.",
        ].map((x) => (
          <span
            key={x}
            style={{
              fontSize: 11.5,
              color: "var(--ink-muted)",
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            · {x}
          </span>
        ))}
      </SectionCard>
    </div>
  );
}
