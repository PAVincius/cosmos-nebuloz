"use client";

// matrix.tsx — adoção × valor, as quatro decisões do portfólio.
//
// É o desenho que carrega a tese: nem adoção nem retorno decidem sozinhos, e o
// cruzamento dos dois nomeia o que fazer. Uma barra ordenada por ROI diria
// "escale a de cima"; a matriz diz "esta usa e não rende — investigue o método"
// e "esta rende e ninguém usa — destrave a adoção", que são problemas
// diferentes com donos diferentes.
//
// Posicionamento em % dentro de um container relativo, não SVG: as bolhas são
// botões de verdade (navegam para o detalhe, recebem foco, respondem a Enter),
// e um <circle> dentro de <svg> não é focável sem gambiarra.

import { fmtAdoption } from "@/lib/signal/adoption";
import type { MatrixPoint } from "@/lib/signal/portfolio";
import { fmtBRL, fmtMultiple } from "@/lib/signal/roi";
import { Eyebrow } from "./base";

/** Rótulo de cada quadrante, na posição em que ele fica. */
const QUADRANTS = [
  {
    key: "PROMISE",
    label: "Promessa parada",
    hint: "rende, mas não escalou",
    tone: "amber",
    style: { top: 0, left: 0 },
  },
  {
    key: "PROVEN",
    label: "Provado",
    hint: "usa e rende",
    tone: "green",
    style: { top: 0, right: 0 },
  },
  {
    key: "STOP",
    label: "Candidata a parada",
    hint: "nem uso nem retorno",
    tone: "neutral",
    style: { bottom: 0, left: 0 },
  },
  {
    key: "VANITY",
    label: "Uso sem valor",
    hint: "usa e não rende",
    tone: "red",
    style: { bottom: 0, right: 0 },
  },
] as const;

const MIN_R = 9;
const MAX_R = 26;

export function AdoptionValueMatrix({
  points,
  adoptionBar,
  valueBar,
  onSelect,
  height = 340,
}: {
  points: MatrixPoint[];
  adoptionBar: number;
  valueBar: number;
  onSelect: (code: string) => void;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          border: "1px dashed var(--hairline-strong)",
          borderRadius: "var(--r-md)",
          fontSize: 12.5,
          color: "var(--ink-faint)",
          textAlign: "center",
          padding: 24,
        }}
      >
        Sem iniciativas ativas para posicionar. A matriz aparece quando houver
        pelo menos uma com baseline assinado e fórmula versionada.
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          position: "relative",
          height,
          borderRadius: "var(--r-md)",
          border: "1px solid var(--hairline)",
          background: "var(--surface-2)",
          overflow: "hidden",
        }}
      >
        {/* Réguas: a linha vertical é a adoção mínima, a horizontal é o valor
            mínimo. São elas que definem os quadrantes — e mudam por tenant. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${adoptionBar}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--hairline-strong)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "var(--hairline-strong)",
          }}
        />

        {QUADRANTS.map((q) => (
          <div
            aria-hidden="true"
            key={q.key}
            style={{
              position: "absolute",
              ...q.style,
              padding: "9px 12px",
              maxWidth: "45%",
            }}
          >
            <Eyebrow tone={q.tone}>{q.label}</Eyebrow>
            <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
              {q.hint}
            </div>
          </div>
        ))}

        {points.map((p) => {
          const r = MIN_R + p.weight * (MAX_R - MIN_R);
          return (
            <button
              className="btn bubble"
              key={p.code}
              onClick={() => onSelect(p.code)}
              style={{
                position: "absolute",
                left: `${p.x}%`,
                bottom: `${p.y}%`,
                // O translate faz o CENTRO da bolha cair na coordenada, não o
                // canto. `signal.css` repete o mesmo translate no keyframe de
                // entrada — sem isso a bolha salta de lugar ao terminar.
                transform: "translate(-50%, 50%)",
                width: r * 2,
                height: r * 2,
                borderRadius: 99,
                border: `1.5px solid rgba(var(--${p.tone}-rgb),.55)`,
                background: `var(--${p.tone}-soft)`,
                color: `var(--${p.tone}-text)`,
                fontSize: 9.5,
                fontWeight: 700,
                fontFamily: "var(--font-jetbrains-mono), monospace",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              title={`${p.code} · ${p.name} — ${p.label}. Adoção ${fmtAdoption(p.adoptionPct)}, retorno ${fmtMultiple(p.multiple)}, investido ${fmtBRL(p.invested)}.`}
              type="button"
            >
              {/* O código dentro da bolha só cabe nas maiores; nas pequenas o
                  título e a legenda abaixo carregam a identificação. */}
              {r > 13 ? p.code.replace("IN-", "") : ""}
              <span className="sr-only">
                {p.code} {p.name}: {p.label}. Adoção{" "}
                {fmtAdoption(p.adoptionPct)}, retorno {fmtMultiple(p.multiple)},
                investido {fmtBRL(p.invested)}.
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 7,
          fontSize: 10.5,
          color: "var(--ink-faint)",
        }}
      >
        <span className="mono">← menos adoção</span>
        <span className="mono">
          réguas: adoção {adoptionBar}% · retorno {fmtMultiple(valueBar)}
        </span>
        <span className="mono">mais adoção →</span>
      </div>
    </div>
  );
}
