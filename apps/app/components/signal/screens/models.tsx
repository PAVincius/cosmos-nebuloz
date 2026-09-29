"use client";

// Modelos de medição — SG-DEV-04.
//
// Cinco modelos, um por forma de trabalho. Cada um diz como se separa o efeito
// da IA do que aconteceria de qualquer jeito (contrafactual), quanto tempo de
// amostra é o mínimo (janela), quais métricas existem e com que papel, e onde o
// número costuma mentir. É o método da Nebuloz: global e versionado, não dado do
// cliente. A tela mostra também quais iniciativas da organização já o usam.

import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  listMeasureModels,
  type MeasureModelCard,
} from "@/app/(signal)/actions/plan-read";
import { PLAN_ROLE_META } from "@/lib/signal/plan";
import {
  Eyebrow,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  Tabs,
  useSignalData,
} from "../base";

const DIRECTION = { UP: "↑", DOWN: "↓" } as const;

function ModelDetail({ model }: { model: MeasureModelCard }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <SectionCard
        subtitle={`${model.versionLabel} · janela mínima de amostra: ${model.sampleWindowWeeks} semanas`}
        title="Contrafactual"
      >
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          {model.counterfactual}
        </p>
        {model.note ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--ink-subtle)",
            }}
          >
            {model.note}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Métricas por papel">
        {model.metrics.map((m) => (
          <div
            key={`${m.role}-${m.name}`}
            style={{
              padding: "9px 0",
              borderBottom: "1px dashed var(--hairline)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--accent-text)",
                }}
                title={PLAN_ROLE_META[m.role].rule}
              >
                {m.roleLabel}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</span>
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--ink-faint)" }}
              >
                {DIRECTION[m.direction]}
              </span>
            </div>
            <div
              className="mono"
              style={{
                marginTop: 3,
                fontSize: 11.5,
                color: "var(--ink-muted)",
              }}
            >
              {m.formula}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 11.5,
                color: "var(--ink-faint)",
              }}
            >
              {PLAN_ROLE_META[m.role].rule}
            </div>
          </div>
        ))}
      </SectionCard>

      <div
        style={{
          display: "grid",
          gap: "var(--gap)",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <SectionCard title="Fontes típicas">
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            {model.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard
          subtitle="Rascunho até um caso de cliente confirmar."
          title="Onde o número costuma mentir"
          tone="amber"
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            {model.traps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title={`Iniciativas em uso (${model.inUse.length})`}>
        {model.inUse.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-faint)" }}>
            Nenhuma iniciativa desta organização usa este modelo ainda.
          </p>
        ) : (
          model.inUse.map((i) => (
            <div key={i.code} style={{ fontSize: 12.5, padding: "4px 0" }}>
              <Eyebrow>{i.code}</Eyebrow> {i.name}
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}

export default function ModelsScreen() {
  const fetcher = useCallback(() => listMeasureModels(), []);
  const { data, loading, error, reload } =
    useSignalData<MeasureModelCard[]>(fetcher);
  const [selected, setSelected] = useState<string | null>(null);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const models = data ?? [];
  const current =
    models.find((m) => m.workForm === selected) ?? models[0] ?? null;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Dado · método"
        subtitle="Cada forma de trabalho tem um modelo: como separar o efeito da IA do que aconteceria de qualquer jeito, quais métricas medem e onde o número costuma mentir."
        title="Modelos de medição"
        tone="accent"
      />

      {loading ? <SkeletonCard /> : null}

      {!loading && models.length === 0 ? (
        <SmartEmptyState
          icon="layers"
          subtitle="Os modelos são publicados pela Nebuloz. Quando houver um para a forma de trabalho da iniciativa, ele aparece aqui."
          title="Nenhum modelo de medição publicado"
          tone="accent"
        />
      ) : null}

      {current ? (
        <>
          <Tabs
            onChange={setSelected}
            tabs={models.map((m) => ({
              id: m.workForm,
              label: m.name,
              count: m.inUse.length,
            }))}
            value={current.workForm}
          />
          <ModelDetail model={current} />
        </>
      ) : null}
    </div>
  );
}
