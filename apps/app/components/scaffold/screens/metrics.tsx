"use client";

// Métricas do produto — SC-PM-04. Tela da consultoria: quatro números em
// leitura simples, e ao lado de cada um o que se mede. Sem dado, diz que falta
// dado: zero seria informação.

import {
  KpiCard,
  PageHeader,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import { getProductMetrics } from "@/app/(scaffold)/actions/metrics";
import type { ProductMetrics } from "@/lib/scaffold/product-metrics";
import { ScreenError } from "../base";

const NO_DATA = "sem dado ainda";

/** Valor já formatado, como texto: o KpiCard anima número, e a leitura simples
 *  quer o número que vale, sem contagem. */
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);
const hours = (n: number | null) =>
  n === null
    ? "—"
    : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} h`;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export default function MetricsScreen() {
  const [data, setData] = useState<ProductMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await getProductMetrics();
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Método · Produto"
        subtitle="Quatro leituras simples do uso do Scaffold nesta organização. Cada uma diz o que mede; sem denominador, aparece que falta dado, e não zero."
        title="Métricas do produto"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {data ? (
          <>
            <KpiCard
              hint={
                data.summaryCoverage.percent === null
                  ? NO_DATA
                  : `${data.summaryCoverage.withSummary} de ${data.summaryCoverage.started} entregáveis iniciados têm resumo`
              }
              icon="fileText"
              label="Entregáveis com resumo"
              tone="accent"
              value={pct(data.summaryCoverage.percent)}
            />
            <KpiCard
              hint={
                data.reviewTime.averageHours === null
                  ? NO_DATA
                  : `média entre enviar e decidir · ${plural(data.reviewTime.reviews, "revisão", "revisões")}`
              }
              icon="clock"
              label="Tempo em revisão"
              tone="amber"
              value={hours(data.reviewTime.averageHours)}
            />
            <KpiCard
              hint={
                data.adjustmentRate.percent === null
                  ? NO_DATA
                  : `${plural(data.adjustmentRate.adjustments, "pedido de ajuste", "pedidos de ajuste")} em ${plural(data.adjustmentRate.decisions, "decisão", "decisões")}`
              }
              icon="refresh"
              label="Taxa de ajuste"
              tone="red"
              value={pct(data.adjustmentRate.percent)}
            />
            <KpiCard
              hint={
                data.catalogStarts.percent === null
                  ? NO_DATA
                  : `${data.catalogStarts.fromCatalog} de ${data.catalogStarts.total} criadas sem lacuna do Meridian`
              }
              icon="layers"
              label="Trilhas pelo catálogo"
              tone="green"
              value={pct(data.catalogStarts.percent)}
            />
          </>
        ) : (
          ["a", "b", "c", "d"].map((k) => <SkeletonKpi key={k} />)
        )}
      </div>
    </div>
  );
}
