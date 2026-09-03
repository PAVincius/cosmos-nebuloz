"use client";

// charts.tsx — séries do Signal.
//
// SVG puro, sem biblioteca de gráfico. Uma linha de 6 pontos em 140×36 px não
// justifica 40 kB de runtime, e a série aqui existe para responder UMA pergunta:
// "está subindo ou descendo?". Precisão de leitura ponto a ponto é papel do
// tooltip, não do desenho.
//
// A escala é sempre relativa à PRÓPRIA série (min..max), nunca a zero. Duas
// razões: a adoção de uma iniciativa entre 71% e 78% ficaria uma reta se o eixo
// começasse em zero, e é justamente a variação que interessa. Onde zero importa
// — o múltiplo de ROI contra o break-even — a régua entra como linha de
// referência explícita, que é honesto e legível ao mesmo tempo.

import { ChartTip } from "@repo/design-system/cosmos/kit";
import { useId, useState } from "react";

export type SparklineProps = {
  /** Série cronológica. Menos de 2 pontos não é tendência: nada é desenhado. */
  values: number[];
  tone?: "green" | "amber" | "red" | "accent" | "blue" | "purple" | "neutral";
  width?: number;
  height?: number;
  /** Linha de referência no valor dado — ex.: 1,0× (break-even) no ROI. */
  threshold?: number;
  /** Rótulo de cada ponto no tooltip. */
  format?: (v: number, index: number) => string;
  ariaLabel: string;
};

type Point = { x: number; y: number; value: number };

const PAD = 3;

function toPoints(input: {
  values: number[];
  width: number;
  height: number;
  min: number;
  max: number;
}): Point[] {
  const { values, width, height, min, max } = input;
  const span = max - min || 1;
  const usable = height - PAD * 2;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, i) => ({
    x: i * step,
    // SVG cresce para baixo; a série cresce para cima.
    y: PAD + usable - ((value - min) / span) * usable,
    value,
  }));
}

export function Sparkline({
  values,
  tone = "accent",
  width = 140,
  height = 36,
  threshold,
  format,
  ariaLabel,
}: SparklineProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  // Uma medição não tem tendência. Desenhar um ponto solto sugeriria série.
  if (values.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          fontSize: 11,
          color: "var(--ink-faint)",
        }}
      >
        Série ainda curta para tendência.
      </div>
    );
  }

  // A régua entra no domínio para não ficar fora do desenho quando a série
  // inteira está de um lado dela.
  const raw = threshold === undefined ? values : [...values, threshold];
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const points = toPoints({ values, width, height, min, max });
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${line} ${width},${height} 0,${height}`;
  const last = points.at(-1) as Point;
  const first = points[0] as Point;
  const rising = last.value >= first.value;
  const thresholdY =
    threshold === undefined
      ? null
      : PAD +
        (height - PAD * 2) -
        ((threshold - min) / (max - min || 1)) * (height - PAD * 2);

  const active = hover === null ? null : points[hover];

  return (
    <div style={{ position: "relative", width, height }}>
      {/* Um handler no próprio svg em vez de um retângulo invisível por ponto:
          mirar numa linha de 1,8 px é impossível, e a alternativa (seis alvos
          transparentes) triplicava o DOM sem ganho.

          O `role="img"` está certo — isto É uma imagem — e o mouseMove não a
          torna interativa: ele só revela um tooltip de conveniência. Nenhum dado
          existe apenas ali: o valor corrente está no card ao lado e a direção da
          série vai em texto logo abaixo. Não há, portanto, funcionalidade
          alcançável só por ponteiro, que é o que a regra existe para impedir. */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: tooltip decorativo sobre dado já disponível em texto — ver acima */}
      <svg
        aria-label={ariaLabel}
        height={height}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - box.left) / (box.width || 1);
          const index = Math.round(ratio * (points.length - 1));
          setHover(Math.min(Math.max(index, 0), points.length - 1));
        }}
        role="img"
        style={{ display: "block", overflow: "visible" }}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={`var(--${tone})`} stopOpacity="0.22" />
            <stop offset="100%" stopColor={`var(--${tone})`} stopOpacity="0" />
          </linearGradient>
        </defs>

        {thresholdY === null ? null : (
          <line
            stroke="var(--hairline-strong)"
            strokeDasharray="3 3"
            strokeWidth={1}
            x1={0}
            x2={width}
            y1={thresholdY}
            y2={thresholdY}
          />
        )}

        <polygon fill={`url(#${gradientId})`} points={area} />
        <polyline
          fill="none"
          points={line}
          stroke={`var(--${tone})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
        />

        {/* O último ponto ganha marcador: é o valor corrente, o que a pessoa
            está lendo no card ao lado. */}
        <circle
          cx={last.x}
          cy={last.y}
          fill={`var(--${tone})`}
          r={2.6}
          stroke="var(--surface)"
          strokeWidth={1.4}
        />

        {/* Marcador do ponto sob o cursor. */}
        {active ? (
          <circle
            cx={active.x}
            cy={active.y}
            fill="var(--surface)"
            r={3.2}
            stroke={`var(--${tone})`}
            strokeWidth={1.8}
          />
        ) : null}
      </svg>

      {active ? (
        <ChartTip left={active.x} px top={active.y - 8}>
          <span className="mono" style={{ fontSize: 11 }}>
            {format
              ? format(active.value, hover as number)
              : String(active.value)}
          </span>
        </ChartTip>
      ) : null}

      {/* A direção também vai em texto: cor sozinha não comunica, e a série é
          pequena demais para leitura confiável em contraste alto. */}
      <span className="sr-only">
        {rising ? "Série em alta" : "Série em queda"}
      </span>
    </div>
  );
}

/** Sparkline de adoção: percentual, com a régua do tenant como referência. */
export function AdoptionSparkline({
  values,
  adoptionBar,
}: {
  values: number[];
  adoptionBar: number;
}) {
  const rising = (values.at(-1) ?? 0) >= (values[0] ?? 0);
  return (
    <Sparkline
      ariaLabel={`Evolução da adoção em ${values.length} períodos`}
      format={(v) => `${Math.round(v)}%`}
      threshold={adoptionBar}
      tone={rising ? "green" : "amber"}
      values={values}
    />
  );
}

/** Sparkline de ROI: múltiplo, com o break-even (1,0×) como referência. */
export function RoiSparkline({ values }: { values: number[] }) {
  const current = values.at(-1) ?? 0;
  return (
    <Sparkline
      ariaLabel={`Evolução do múltiplo de ROI em ${values.length} períodos`}
      format={(v) => `${v.toFixed(1).replace(".", ",")}×`}
      // Break-even é a referência que importa: abaixo de 1,0× a iniciativa
      // custa mais do que devolve, e isso precisa ser visível no desenho.
      threshold={1}
      tone={current >= 1 ? "green" : "red"}
      values={values}
    />
  );
}

/** Sparkline de resultado. A direção da métrica decide o que é "bom". */
export function OutcomeSparkline({
  values,
  direction,
}: {
  values: number[];
  direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";
}) {
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const improved =
    direction === "LOWER_IS_BETTER" ? last < first : last > first;
  return (
    <Sparkline
      ariaLabel={`Evolução do resultado em ${values.length} períodos`}
      format={(v) => String(Math.round(v * 100) / 100)}
      tone={improved ? "green" : "red"}
      values={values}
    />
  );
}
