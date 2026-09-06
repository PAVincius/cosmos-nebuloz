"use client";

/**
 * Camadas de apresentação do grafo (Task 4, spec §4). Extraído de `grafo.tsx`
 * só por tamanho de arquivo: nenhum componente aqui tem estado próprio — pan,
 * zoom, arraste e hover moram todos em `Grafo`, que passa posições e
 * callbacks já prontos. Biome proíbe componente definido dentro de
 * componente, então cada camada do design (fundo, anéis, núcleo, mancha,
 * rótulo, aresta, nó, controles, rodapé) é uma função de módulo aqui.
 */
import { Icon } from "@repo/design-system/cosmos/icons";
import { IconButton, type Tone } from "@repo/design-system/cosmos/kit";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  NIVEIS,
  type Nivel,
  type Ponto,
  type Processo,
  STATUS,
  type Status,
} from "@/lib/ferramentas/processos";

const TECLA_ENTER = "Enter";

/** Único lugar que decide "Enter ativa como clique" — nó, mancha e rótulo de
 *  área usam o mesmo par onClick/onKeyDown. */
function aoTeclarComoClique(
  e: KeyboardEvent<Element>,
  onSelecionar: () => void
): void {
  if (e.key === TECLA_ENTER) {
    onSelecionar();
  }
}

function pluralizar(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/** Espessura do traço: destacada > entre domínios > comum — três casos
 *  mutuamente exclusivos, por isso `if`, não ternário encadeado. */
function larguraDaAresta(destacada: boolean, forte: boolean): number {
  if (destacada) {
    return 2;
  }
  if (forte) {
    return 1.6;
  }
  return 1;
}

/** `<defs>` do SVG: pontilhado de fundo, desfoque das manchas e as duas setas
 *  (fraca para aresta comum, forte para aresta que toca a seleção). Um lugar
 *  só — cada camada que precisa de um destes só referencia o `id` via `url()`. */
export function Defs() {
  return (
    <defs>
      <pattern
        height={26}
        id="grafo-pontos"
        patternUnits="userSpaceOnUse"
        width={26}
      >
        <circle
          cx={1.4}
          cy={1.4}
          fill="var(--hairline-strong)"
          opacity={0.7}
          r={1.15}
        />
      </pattern>
      <filter height="240%" id="grafo-mancha" width="240%" x="-70%" y="-70%">
        <feGaussianBlur stdDeviation={30} />
      </filter>
      <marker
        id="grafo-seta"
        markerHeight={7}
        markerWidth={7}
        orient="auto-start-reverse"
        refX={8.5}
        refY={4}
        viewBox="0 0 9 8"
      >
        <path d="M0 0L9 4L0 8Z" fill="var(--ink-faint)" />
      </marker>
      <marker
        id="grafo-seta-forte"
        markerHeight={7.5}
        markerWidth={7.5}
        orient="auto-start-reverse"
        refX={8.5}
        refY={4}
        viewBox="0 0 9 8"
      >
        <path d="M0 0L9 4L0 8Z" fill="var(--accent)" />
      </marker>
    </defs>
  );
}

/** Camada 1: fundo pontilhado. Vive fora do grupo com `scale(zoom)` — só
 *  translada com o pan, então o zoom nunca muda a densidade dos pontos.
 *  O retângulo é 3× o canvas para não faltar pontilhado nas bordas ao
 *  arrastar o fundo. */
export function FundoPontilhado({
  pan,
  w,
  h,
}: {
  pan: Ponto;
  w: number;
  h: number;
}) {
  return (
    <g transform={`translate(${pan.x} ${pan.y})`}>
      <rect
        fill="url(#grafo-pontos)"
        height={h * 3}
        width={w * 3}
        x={-w}
        y={-h}
      />
    </g>
  );
}

/** Camada 2: os três anéis de nível, com o rótulo "N · NÍVEL" na borda
 *  superior de cada elipse. */
export function AneisDeNivel({
  cx,
  cy,
  aneis,
}: {
  cx: number;
  cy: number;
  aneis: Record<Nivel, { rx: number; ry: number }>;
}) {
  const niveis: Nivel[] = [1, 2, 3];
  return (
    <g fill="none" stroke="var(--hairline-strong)" strokeDasharray="2 6">
      {niveis.map((nivel) => (
        <g key={nivel}>
          <ellipse cx={cx} cy={cy} rx={aneis[nivel].rx} ry={aneis[nivel].ry} />
          <text
            fill="var(--ink-faint)"
            fontSize={10.5}
            fontWeight={700}
            letterSpacing="0.05em"
            stroke="none"
            textAnchor="middle"
            x={cx}
            y={cy - aneis[nivel].ry - 8}
          >
            {`${nivel} · ${NIVEIS[nivel].rotulo.toUpperCase()}`}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Camada 3: núcleo — o centro dos anéis, sem rótulo próprio. */
export function Nucleo({ cx, cy }: { cx: number; cy: number }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      fill="var(--surface-3)"
      r={16}
      stroke="var(--hairline-strong)"
    />
  );
}

/** Camada 4: a mancha desfocada de um domínio — um círculo por nó do domínio
 *  mais um maior no centroide, todos sob o mesmo `feGaussianBlur`. Clicar
 *  seleciona o primeiro nó do domínio (mesmo alvo do rótulo, camada 5). `<g>`
 *  em SVG não tem equivalente `<button>` nativo — `role`+`tabIndex`+
 *  `onKeyDown` cobrem o teclado, como no nó (camada 7). */
export function Mancha({
  tom,
  nos,
  centro,
  opacidade,
  rotulo,
  onSelecionar,
}: {
  tom: Tone;
  nos: { id: string; pos: Ponto }[];
  centro: Ponto;
  opacidade: number;
  rotulo: string;
  onSelecionar: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <g> dentro de <svg> não vira <button> — a mancha é um blob desfocado sem retângulo de hit-test próprio; role+tabIndex+onKeyDown cobrem o teclado.
    <g
      aria-label={rotulo}
      filter="url(#grafo-mancha)"
      onClick={onSelecionar}
      onKeyDown={(e) => aoTeclarComoClique(e, onSelecionar)}
      role="button"
      style={{ cursor: "pointer" }}
      tabIndex={0}
    >
      {nos.map((n) => (
        <circle
          cx={n.pos.x}
          cy={n.pos.y}
          fill={`var(--${tom})`}
          key={n.id}
          opacity={opacidade}
          r={92}
        />
      ))}
      <circle
        cx={centro.x}
        cy={centro.y}
        fill={`var(--${tom})`}
        opacity={opacidade}
        r={150}
      />
    </g>
  );
}

/** Camada 5: rótulo do domínio ("COMERCIAL · 4"), sob o cluster. Mesmo alvo
 *  de clique que a mancha. */
export function RotuloDominio({
  x,
  y,
  tom,
  texto,
  onSelecionar,
}: {
  x: number;
  y: number;
  tom: Tone;
  texto: string;
  onSelecionar: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <g> dentro de <svg> não vira <button> — role+tabIndex+onKeyDown cobrem o teclado, mesmo caso da mancha acima.
    <g
      onClick={onSelecionar}
      onKeyDown={(e) => aoTeclarComoClique(e, onSelecionar)}
      role="button"
      style={{ cursor: "pointer" }}
      tabIndex={0}
    >
      <text
        fill={`var(--${tom}-text)`}
        fontSize={11}
        fontWeight={800}
        letterSpacing="0.04em"
        textAnchor="middle"
        x={x}
        y={y}
      >
        {texto}
      </text>
    </g>
  );
}

/** Camada 6: uma aresta reta com seta. Mais forte quando liga domínios
 *  diferentes; realçada com o rótulo em pílula quando toca a seleção,
 *  esmaecida fora dela. Sem interação própria — não é alvo de clique. */
export function Aresta({
  de,
  para,
  rotulo,
  destacada,
  forte,
}: {
  de: Ponto;
  para: Ponto;
  rotulo: string;
  destacada: boolean;
  forte: boolean;
}) {
  const meio = { x: (de.x + para.x) / 2, y: (de.y + para.y) / 2 };
  const largura = larguraDaAresta(destacada, forte);
  const corTraco = destacada ? "var(--accent)" : "var(--hairline-strong)";
  const larguraPill = rotulo.length * 5.6 + 14;
  return (
    <g opacity={destacada ? 0.95 : 0.4}>
      <line
        markerEnd={destacada ? "url(#grafo-seta-forte)" : "url(#grafo-seta)"}
        stroke={corTraco}
        strokeWidth={largura}
        x1={de.x}
        x2={para.x}
        y1={de.y}
        y2={para.y}
      />
      {destacada ? (
        <g>
          <rect
            fill="var(--surface)"
            height={16}
            rx={8}
            stroke="var(--hairline-strong)"
            width={larguraPill}
            x={meio.x - larguraPill / 2}
            y={meio.y - 8}
          />
          <text
            fill="var(--ink)"
            fontSize={9.5}
            fontWeight={700}
            textAnchor="middle"
            x={meio.x}
            y={meio.y + 3.4}
          >
            {rotulo}
          </text>
        </g>
      ) : null}
    </g>
  );
}

/** A pílula do nó (nome + "N2 · Modelado"), aberta em hover ou seleção. Sem
 *  medir texto (jsdom não implementa `getBBox`): a largura é uma estimativa
 *  por número de caracteres, generosa o bastante para não cortar. */
function PillDoNo({
  p,
  raio,
  status,
}: {
  p: Processo;
  raio: number;
  status: Status;
}) {
  const linha2 = `N${p.nivel} · ${STATUS[status].rotulo}`;
  const largura = Math.max(p.nome.length, linha2.length) * 6.1 + 20;
  const x = raio + 10;
  const y = -22;
  return (
    <g pointerEvents="none">
      <rect
        fill="var(--surface)"
        height={38}
        rx={9}
        stroke="var(--hairline-strong)"
        width={largura}
        x={x}
        y={y}
      />
      <text
        fill="var(--ink)"
        fontSize={11}
        fontWeight={700}
        x={x + 10}
        y={y + 15}
      >
        {p.nome}
      </text>
      <text fill="var(--ink-faint)" fontSize={9.5} x={x + 10} y={y + 29}>
        {linha2}
      </text>
    </g>
  );
}

/** Camada 7: o nó — círculo com a inicial, que abre em pílula no hover ou na
 *  seleção. `quente` (resultado de busca, por exemplo) ganha um halo
 *  pontilhado, independente de hover/seleção. */
export function No({
  p,
  pos,
  raio,
  tom,
  status,
  selecionado,
  emFoco,
  quente,
  onSelecionar,
  onPointerDown,
  onFocoEntrar,
  onFocoSair,
}: {
  p: Processo;
  pos: Ponto;
  raio: number;
  tom: Tone;
  status: Status;
  selecionado: boolean;
  emFoco: boolean;
  quente: boolean;
  onSelecionar: () => void;
  onPointerDown: (e: PointerEvent<SVGCircleElement>) => void;
  onFocoEntrar: () => void;
  onFocoSair: () => void;
}) {
  const expandido = selecionado || emFoco;
  const inicial = p.nome.trim().charAt(0).toUpperCase() || "?";
  const corBorda = selecionado ? "var(--accent)" : "var(--surface)";
  const larguraBorda = selecionado ? 2.4 : 1.6;
  return (
    <g transform={`translate(${pos.x} ${pos.y})`}>
      {quente ? (
        <circle
          fill="none"
          r={raio + 6}
          stroke="var(--accent)"
          strokeDasharray="3 3"
        />
      ) : null}
      {/* biome-ignore lint/a11y/useSemanticElements: círculo posicionado por transform em <svg> — um <button> nativo não teria a forma nem a área de clique circular que o nó exige; role+tabIndex+onKeyDown cobrem o teclado. */}
      <circle
        aria-label={`${p.codigo} ${p.nome}`}
        fill={`var(--${tom})`}
        onClick={onSelecionar}
        onKeyDown={(e) => aoTeclarComoClique(e, onSelecionar)}
        onMouseEnter={onFocoEntrar}
        onMouseLeave={onFocoSair}
        onPointerDown={onPointerDown}
        r={raio}
        role="button"
        stroke={corBorda}
        strokeWidth={larguraBorda}
        style={{ cursor: "pointer" }}
        tabIndex={0}
      />
      <text
        dominantBaseline="central"
        fill="var(--on-solid)"
        fontSize={raio * 0.62}
        fontWeight={800}
        pointerEvents="none"
        textAnchor="middle"
      >
        {inicial}
      </text>
      {expandido ? <PillDoNo p={p} raio={raio} status={status} /> : null}
    </g>
  );
}

/** Botão `.canvas`, canto superior direito — exportar é leitura, então
 *  aparece mesmo sem permissão de escrita (decisão do controlador, não desta
 *  camada). */
export function BotaoExportar({ onExportar }: { onExportar: () => void }) {
  return (
    <button
      className="btn"
      onClick={onExportar}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
        fontSize: 11.5,
        fontWeight: 700,
        color: "var(--ink)",
        cursor: "pointer",
      }}
      type="button"
    >
      <Icon name="download" size={13} strokeWidth={2.2} />
      .canvas
    </button>
  );
}

/** Aproximar/afastar/enquadrar, canto inferior direito. */
export function ControlesDeZoom({
  onAproximar,
  onAfastar,
  onEnquadrar,
}: {
  onAproximar: () => void;
  onAfastar: () => void;
  onEnquadrar: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 42,
        right: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <IconButton name="plus" onClick={onAproximar} title="Aproximar" />
      <IconButton name="minus" onClick={onAfastar} title="Afastar" />
      <IconButton name="maximize" onClick={onEnquadrar} title="Enquadrar" />
    </div>
  );
}

/** Rodapé: contagem de nós/grupos/arestas, dica de uso e o zoom em
 *  porcentagem. */
export function Rodape({
  nos,
  grupos,
  arestas,
  zoomPercent,
}: {
  nos: number;
  grupos: number;
  arestas: number;
  zoomPercent: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 8,
        left: 12,
        right: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        fontSize: 10.5,
        color: "var(--ink-faint)",
        pointerEvents: "none",
      }}
    >
      <span className="mono">
        {nos} {pluralizar(nos, "NÓ", "NÓS")} · {grupos}{" "}
        {pluralizar(grupos, "GRUPO", "GRUPOS")} · {arestas}{" "}
        {pluralizar(arestas, "ARESTA", "ARESTAS")}
      </span>
      <span>
        Roda: pan · ⌘/Ctrl + roda: zoom · Espaço: mover · Esc: limpar seleção
      </span>
      <span className="mono">{zoomPercent}%</span>
    </div>
  );
}
