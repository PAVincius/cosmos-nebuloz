"use client";

// Aba Gap register do assessment — US4. Port de `meridian-screens-2.jsx`.
//
// O grafo é desenhado por profundidade topológica: coluna 0 são os gaps sem
// pré-requisito, e cada coluna seguinte depende da anterior. Clicar num gap
// isola a vizinhança — num grafo de oito nós isso já é a diferença entre ler e
// adivinhar.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  Progress,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import { type GapRow, listGapRegister } from "@/app/(meridian)/actions/gaps";
import { AXES } from "@/lib/meridian/axes";
import { depthOf } from "@/lib/meridian/graph";
import {
  Eyebrow,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  TableHead,
  TableRow,
  useMeridianData,
} from "../base";
import { SEVERITY } from "./gap-register";

const COLS = "70px 1.9fr 110px 90px 110px 1fr";

type Edge = { from: string; to: string };

export default function GapsTab({ a }: { a: AssessmentDetail }) {
  const fetcher = useCallback(
    () => listGapRegister({ assessmentId: a.id }),
    [a.id]
  );
  const { data, loading, error, reload } = useMeridianData<GapRow[]>(fetcher);

  const [sel, setSel] = useState<string | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const [edgeGeom, setEdgeGeom] = useState<
    {
      from: string;
      to: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[]
  >([]);

  const gaps = data ?? [];
  const edges: Edge[] = gaps.flatMap((g) =>
    g.dependsOn.map((d) => ({ from: g.code, to: d }))
  );

  // Mede as arestas depois do layout: a posição dos nós depende do fluxo, e
  // calcular no render daria coordenadas do frame anterior.
  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) {
        return;
      }
      const wr = wrap.getBoundingClientRect();
      setEdgeGeom(
        edges.flatMap((e) => {
          const from = nodeRefs.current[e.to];
          const to = nodeRefs.current[e.from];
          if (!(from && to)) {
            return [];
          }
          const fr = from.getBoundingClientRect();
          const tr = to.getBoundingClientRect();
          return [
            {
              from: e.to,
              to: e.from,
              x1: fr.right - wr.left,
              y1: fr.top + fr.height / 2 - wr.top,
              x2: tr.left - wr.left,
              y2: tr.top + tr.height / 2 - wr.top,
            },
          ];
        })
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [edges]);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading) {
    return <SkeletonCard />;
  }
  if (gaps.length === 0) {
    return (
      <SmartEmptyState
        icon="target"
        subtitle="Rode o scoring e conclua a revisão para derivar gaps dos eixos abaixo do limiar."
        title="Gaps ainda não derivados"
        tone="accent"
      />
    );
  }

  const depth = depthOf(
    gaps.map((g) => ({ code: g.code, costOfDelay: g.costOfDelay })),
    edges
  );
  const maxDepth = Math.max(...[...depth.values()]);
  const columns = Array.from({ length: maxDepth + 1 }, (_, d) => ({
    // A profundidade é a identidade estável da coluna — o índice do array não
    // é, e reordenar o grafo remontaria a coluna inteira.
    depth: d,
    gaps: gaps.filter((g) => depth.get(g.code) === d),
  }));
  const related = sel
    ? new Set([
        sel,
        ...gaps.filter((g) => g.dependsOn.includes(sel)).map((g) => g.code),
        ...(gaps.find((g) => g.code === sel)?.dependsOn ?? []),
      ])
    : null;
  const ranked = [...gaps].sort((x, y) => y.costOfDelay - x.costOfDelay);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <SectionCard
        action={
          sel && (
            <Button
              icon="x"
              onClick={() => setSel(null)}
              size="sm"
              variant="ghost"
            >
              Limpar foco
            </Button>
          )
        }
        bodyStyle={{ padding: 0, overflowX: "auto" }}
        icon="layers"
        subtitle="DAG — ciclo é rejeitado na escrita. Clique num gap para isolar a vizinhança."
        title="Grafo de dependências"
      >
        <div
          ref={wrapRef}
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, minmax(200px,1fr))`,
            minWidth: 640,
          }}
        >
          <svg
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="meridianGapArrow"
                markerHeight="6"
                markerWidth="6"
                orient="auto-start-reverse"
                refX="8.5"
                refY="5"
                viewBox="0 0 10 10"
              >
                <path d="M0 0 10 5 0 10z" fill="var(--ink-faint)" />
              </marker>
            </defs>
            {edgeGeom.map((e) => {
              const active = sel && (e.from === sel || e.to === sel);
              const dim = related && !active;
              const mx = (e.x1 + e.x2) / 2;
              return (
                <path
                  d={`M${e.x1} ${e.y1} C${mx} ${e.y1} ${mx} ${e.y2} ${e.x2 - 4} ${e.y2}`}
                  fill="none"
                  key={`${e.from}-${e.to}`}
                  markerEnd="url(#meridianGapArrow)"
                  opacity={dim ? 0.12 : active ? 0.9 : 0.45}
                  stroke={active ? "var(--accent)" : "var(--ink-faint)"}
                  strokeDasharray={active ? "none" : "4 3"}
                  strokeWidth={active ? 2 : 1.4}
                />
              );
            })}
          </svg>

          {columns.map(({ depth: d, gaps: list }) => (
            <div
              key={`nivel-${d}`}
              style={{
                borderRight:
                  d < columns.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <div
                style={{
                  padding: "9px 14px",
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <Eyebrow>
                  {d === 0 ? "Sem pré-requisito" : `Depende de nível ${d - 1}`}
                </Eyebrow>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 12,
                }}
              >
                {list.map((g) => {
                  const on = sel === g.code;
                  const dim = related && !related.has(g.code);
                  return (
                    <button
                      aria-pressed={on}
                      className="btn"
                      key={g.code}
                      onClick={() =>
                        setSel((s) => (s === g.code ? null : g.code))
                      }
                      ref={(el) => {
                        nodeRefs.current[g.code] = el;
                      }}
                      style={{
                        position: "relative",
                        zIndex: 2,
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: "var(--r-md)",
                        background: on
                          ? "var(--accent-soft)"
                          : "var(--surface-2)",
                        border: `1px solid ${on ? "rgba(var(--accent-rgb),.5)" : "var(--hairline)"}`,
                        color: "var(--ink)",
                        opacity: dim ? 0.3 : 1,
                        transition: "opacity .2s ease",
                      }}
                      type="button"
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          width: "100%",
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--ink-faint)",
                          }}
                        >
                          {g.code}
                        </span>
                        <Badge tone={SEVERITY[g.severity].tone}>
                          {SEVERITY[g.severity].label}
                        </Badge>
                        <span
                          className="mono"
                          style={{
                            marginLeft: "auto",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--amber-text)",
                          }}
                        >
                          CoD {g.costOfDelay}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          lineHeight: 1.45,
                        }}
                      >
                        {g.statement.split(":")[0]}
                      </span>
                      {g.dependsOn.length > 0 && (
                        <span
                          className="mono"
                          style={{ fontSize: 9.5, color: "var(--ink-faint)" }}
                        >
                          ← {g.dependsOn.join(", ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        bodyStyle={{ padding: 0 }}
        icon="target"
        subtitle="Derivados do scoring, ajustáveis pelo consultor — severidade, esforço e dono"
        title="Gaps por custo de atraso"
      >
        <TableHead
          cols={COLS}
          labels={[
            "ID",
            "Gap",
            "Eixo",
            "Esforço",
            { t: "Custo de atraso", align: "right" },
            "Dono",
          ]}
        />
        {ranked.map((g, i) => (
          <TableRow cols={COLS} key={g.id} last={i === ranked.length - 1}>
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ink-faint)",
              }}
            >
              {g.code}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
              {g.statement}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon
                name={AXES[g.axis].icon}
                size={13}
                style={{ color: "var(--ink-faint)" }}
              />
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--ink-muted)",
                }}
              >
                {AXES[g.axis].label}
              </span>
            </span>
            <span className="mono" style={{ fontSize: 11.5 }}>
              {g.effort}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                justifyContent: "flex-end",
              }}
            >
              <span style={{ width: 46 }}>
                <Progress
                  height={4}
                  tone={SEVERITY[g.severity].tone}
                  value={g.costOfDelay}
                />
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--amber-text)",
                  width: 22,
                  textAlign: "right",
                }}
              >
                {g.costOfDelay}
              </span>
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                fontWeight: 600,
              }}
            >
              {g.ownerLabel}
            </span>
          </TableRow>
        ))}
      </SectionCard>
    </div>
  );
}
