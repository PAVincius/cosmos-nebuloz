"use client";

/**
 * O grafo do mapa de processos (Task 4, spec §4; design `ProcessGraph` de
 * backoffice-process-map.jsx). Componente de apresentação puro: recebe
 * `processos`/`ligacoes` já filtrados pelo controlador (`mapa.tsx`, Task 5) e
 * devolve intenção por callback — nenhuma chamada de action mora aqui. As
 * camadas visuais (fundo, anéis, núcleo, mancha, rótulo, aresta, nó,
 * controles, rodapé) moram em `grafo-partes.tsx`, separadas só por tamanho de
 * arquivo — todo estado (pan, zoom, hover, arraste temporário) mora aqui.
 *
 * Cortes da spec §0, não portados: poeira estelar animada, "molas", tema do
 * céu (auto/claro/escuro) e marquee multi-seleção — a tela segue o tema da
 * página, e a mancha desfocada por área é a única sobra da metáfora estelar.
 */
import type { Tone } from "@repo/design-system/cosmos/kit";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DOMINIOS,
  type Dominio,
  type Ligacao,
  layoutPolar,
  type Nivel,
  type Ponto,
  type Processo,
  statusDe,
  vizinhos,
} from "@/lib/ferramentas/processos";
import { tomCss } from "@/lib/tom";
import {
  AneisDeNivel,
  Aresta,
  BotaoExportar,
  ControlesDeZoom,
  Defs,
  FundoPontilhado,
  Mancha,
  No,
  Nucleo,
  Rodape,
  RotuloDominio,
} from "./grafo-partes";

export type GrafoProps = {
  processos: Processo[];
  ligacoes: Ligacao[];
  selecionado: string | null;
  /** Nó em destaque por um motivo alheio ao clique — por exemplo, o primeiro
   *  resultado de uma busca no controlador. Ganha um halo, sem abrir a pílula
   *  sozinho (isso é hover/seleção). */
  quente: string | null;
  onSelecionar: (id: string | null) => void;
  onExportar: () => void;
};

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const FATOR_ZOOM_BOTAO = 1.2;
const FATOR_ZOOM_RODA = 0.12;
/** Soltar um nó a mais disso da posição de layout manda ele de volta pra
 *  casa; mais perto, ele fica onde caiu (temporário, some ao recarregar). */
const DISTANCIA_VOLTA_PX = 190;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** O próprio canvas é focável (`tabIndex=0`, ver abaixo) e não é ativado por
 *  Space — fica fora do seletor para o "modo mão" continuar funcionando com
 *  ele focado. */
const SELETOR_INTERATIVO =
  "button, select, a, input, textarea, [tabindex]:not([data-mapa-canvas])";

/** Space é a tecla de ativação de `<button>` (e afins) — sequestrar o evento
 *  pro "modo mão" enquanto um desses tem foco impede ativar "Novo processo",
 *  os chips, "Editar"/"Excluir", o × da ligação ou abrir o `<select>` pelo
 *  teclado. */
function elementoInterativo(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest(SELETOR_INTERATIVO) !== null;
}

/** Escape com um diálogo aberto é do diálogo: o Radix já o consumiu
 *  (`defaultPrevented`) e o foco está preso lá dentro. Limpar a seleção aqui
 *  fechava o painel junto com o `ProcessoDialog`. */
function escapeDeOutraCamada(e: globalThis.KeyboardEvent): boolean {
  return (
    e.defaultPrevented ||
    (e.target instanceof Element && e.target.closest("[role=dialog]") !== null)
  );
}

/** Raio cresce com o grau do nó (quantas ligações tocam nele) e com nível 1
 *  (estratégico) partindo de uma base maior. */
function raioDoNo(nivel: Nivel, grau: number): number {
  const base = nivel === 1 ? 20 : 14;
  return clamp(base + grau * 1.8, base, 34);
}

/** Client px → unidades do viewBox do SVG, independente do zoom aplicado ao
 *  conteúdo — é a escala imposta só pelo CSS width/height vs. o `viewBox`. */
function fatorDeEscala(svg: SVGSVGElement | null, w: number, h: number): Ponto {
  if (!svg) {
    return { x: 1, y: 1 };
  }
  const rect = svg.getBoundingClientRect();
  return {
    x: rect.width > 0 ? w / rect.width : 1,
    y: rect.height > 0 ? h / rect.height : 1,
  };
}

function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centroDeMassa(pontos: Ponto[]): Ponto {
  return {
    x: pontos.reduce((soma, p) => soma + p.x, 0) / pontos.length,
    y: pontos.reduce((soma, p) => soma + p.y, 0) / pontos.length,
  };
}

type GrupoDominio = {
  dominio: Dominio;
  tom: Tone;
  nos: { id: string; pos: Ponto }[];
  centro: Ponto;
  primeiro: string;
  rotulo: string;
  yRotulo: number;
};

/** Um grupo por domínio presente no conjunto visível — domínio sem nó visível
 *  não tem mancha nem rótulo (não há centroide de conjunto vazio). */
function construirGrupos(
  processos: Processo[],
  posDoNo: (id: string) => Ponto,
  raioDoId: Map<string, number>
): GrupoDominio[] {
  const dominios = Object.keys(DOMINIOS) as Dominio[];
  const grupos: GrupoDominio[] = [];
  for (const dominio of dominios) {
    const doDominio = processos.filter((p) => p.dominio === dominio);
    if (doDominio.length === 0) {
      continue;
    }
    const nos = doDominio.map((p) => ({ id: p.id, pos: posDoNo(p.id) }));
    const yMax = Math.max(
      ...nos.map((n) => n.pos.y + (raioDoId.get(n.id) ?? 14))
    );
    grupos.push({
      dominio,
      tom: tomCss(DOMINIOS[dominio].tom),
      nos,
      centro: centroDeMassa(nos.map((n) => n.pos)),
      primeiro: doDominio[0].id,
      rotulo: `${DOMINIOS[dominio].rotulo.toUpperCase()} · ${doDominio.length}`,
      yRotulo: yMax + 20,
    });
  }
  return grupos;
}

function construirGraus(
  processos: Processo[],
  ligacoesVisiveis: Ligacao[]
): Map<string, number> {
  const graus = new Map<string, number>();
  for (const p of processos) {
    graus.set(p.id, vizinhos(p.id, ligacoesVisiveis).length);
  }
  return graus;
}

type Arraste = { id: string; inicioCliente: Ponto; inicioPos: Ponto };
type PanEmCurso = { inicioCliente: Ponto; inicioPan: Ponto };

export function Grafo({
  processos,
  ligacoes,
  selecionado,
  quente,
  onSelecionar,
  onExportar,
}: GrafoProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const arrasteRef = useRef<Arraste | null>(null);
  const panRef = useRef<PanEmCurso | null>(null);

  const [pan, setPan] = useState<Ponto>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [emFocoId, setEmFocoId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Ponto>>({});
  const [espaco, setEspaco] = useState(false);

  // Esc limpa a seleção e Espaço liga o "modo mão" (arrastar o fundo de
  // qualquer ponto, inclusive sobre um nó) — os dois em listener de janela
  // porque o alvo do teclado pode ser o `<svg>` ou nenhum elemento focado.
  useEffect(() => {
    function aoTeclarBaixo(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (!escapeDeOutraCamada(e)) {
          onSelecionar(null);
        }
        return;
      }
      if (e.code === "Space" && !elementoInterativo(e.target)) {
        e.preventDefault();
        setEspaco(true);
      }
    }
    function aoTeclarCima(e: globalThis.KeyboardEvent) {
      if (e.code === "Space") {
        setEspaco(false);
      }
    }
    window.addEventListener("keydown", aoTeclarBaixo);
    window.addEventListener("keyup", aoTeclarCima);
    return () => {
      window.removeEventListener("keydown", aoTeclarBaixo);
      window.removeEventListener("keyup", aoTeclarCima);
    };
  }, [onSelecionar]);

  // Layout, índice por id, ligações visíveis, grau e raio — nenhum depende de
  // pan/zoom/arraste, só de `processos`/`ligacoes`. `useMemo` evita refazer
  // essa conta a cada render, inclusive a cada tick de um arraste em curso.
  const { layout, porId, ligacoesVisiveis, raiosPorId } = useMemo(() => {
    const novoLayout = layoutPolar(processos);
    const novoPorId = new Map(processos.map((p) => [p.id, p]));
    const novasVisiveis = ligacoes.filter(
      (l) => novoPorId.has(l.deId) && novoPorId.has(l.paraId)
    );
    const novosGraus = construirGraus(processos, novasVisiveis);
    const novosRaios = new Map(
      processos.map((p) => [p.id, raioDoNo(p.nivel, novosGraus.get(p.id) ?? 0)])
    );
    return {
      layout: novoLayout,
      porId: novoPorId,
      ligacoesVisiveis: novasVisiveis,
      raiosPorId: novosRaios,
    };
  }, [processos, ligacoes]);

  function posEfetiva(id: string): Ponto {
    return overrides[id] ?? layout.pos[id];
  }

  const grupos = construirGrupos(processos, posEfetiva, raiosPorId);
  const opacidadeMancha = selecionado ? 0.14 : 0.3;

  function aproximar() {
    setZoom((z) => clamp(z * FATOR_ZOOM_BOTAO, ZOOM_MIN, ZOOM_MAX));
  }
  function afastar() {
    setZoom((z) => clamp(z / FATOR_ZOOM_BOTAO, ZOOM_MIN, ZOOM_MAX));
  }
  function enquadrar() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // `aoRodar` lê zoom/pan/layout de um ref, não do closure — assim a função
  // tem identidade estável e o `useEffect` abaixo registra o listener nativo
  // uma vez só, em vez de remover e recriar a cada tick de pan/zoom.
  const estadoRodaRef = useRef({ zoom, pan, w: layout.W, h: layout.H });
  useEffect(() => {
    estadoRodaRef.current = { zoom, pan, w: layout.W, h: layout.H };
  });

  // ⌘/Ctrl mantém o ponto sob o cursor fixo ao dar zoom; sem o modificador, a
  // roda só faz pan (comportamento padrão de canvas infinito). React 19
  // registra `wheel` como listener passivo quando ligado via prop JSX
  // `onWheel` — `preventDefault` dentro dele seria ignorado silenciosamente,
  // deixando o pinch do trackpad dar zoom na página e a roda simples rolar o
  // fundo. Por isso o listener é nativo (useEffect abaixo) com
  // `{ passive: false }`, e o parâmetro é o `WheelEvent` do DOM.
  //
  // Mas a roda só é do mapa quando a pessoa o escolheu: canvas focado (clique
  // nele) ou modificador. Sem isso, um canvas de 640px no meio da página
  // travava a rolagem de quem só queria passar por ele.
  const aoRodar = useCallback((e: globalThis.WheelEvent) => {
    const { zoom: zoomAtual, pan: panAtual, w, h } = estadoRodaRef.current;
    const modificador = e.ctrlKey || e.metaKey;
    const focado = canvasRef.current?.contains(document.activeElement) ?? false;
    if (!(modificador || focado)) {
      return;
    }
    if (!modificador) {
      e.preventDefault();
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const escala = fatorDeEscala(svgRef.current, w, h);
    const svgX = (e.clientX - rect.left) * escala.x;
    const svgY = (e.clientY - rect.top) * escala.y;
    const novoZoom = clamp(
      zoomAtual * (e.deltaY > 0 ? 1 - FATOR_ZOOM_RODA : 1 + FATOR_ZOOM_RODA),
      ZOOM_MIN,
      ZOOM_MAX
    );
    const worldX = (svgX - panAtual.x) / zoomAtual;
    const worldY = (svgY - panAtual.y) / zoomAtual;
    setZoom(novoZoom);
    setPan({ x: svgX - worldX * novoZoom, y: svgY - worldY * novoZoom });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) {
      return;
    }
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, [aoRodar]);

  // Aceita qualquer `PointerEvent` do React (nó ou fundo), não só o do
  // `<svg>` raiz — só `clientX`/`clientY` importam aqui.
  function iniciarPan(e: { clientX: number; clientY: number }) {
    panRef.current = {
      inicioCliente: { x: e.clientX, y: e.clientY },
      inicioPan: pan,
    };
  }

  function iniciarArrasteDoNo(e: PointerEvent<SVGCircleElement>, id: string) {
    e.stopPropagation();
    if (espaco) {
      iniciarPan(e);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasteRef.current = {
      id,
      inicioCliente: { x: e.clientX, y: e.clientY },
      inicioPos: posEfetiva(id),
    };
  }

  function aoMoverPonteiro(e: PointerEvent<SVGSVGElement>) {
    const escala = fatorDeEscala(svgRef.current, layout.W, layout.H);
    const arraste = arrasteRef.current;
    if (arraste) {
      const dx = ((e.clientX - arraste.inicioCliente.x) * escala.x) / zoom;
      const dy = ((e.clientY - arraste.inicioCliente.y) * escala.y) / zoom;
      setOverrides((o) => ({
        ...o,
        [arraste.id]: {
          x: arraste.inicioPos.x + dx,
          y: arraste.inicioPos.y + dy,
        },
      }));
      return;
    }
    const emCurso = panRef.current;
    if (emCurso) {
      setPan({
        x:
          emCurso.inicioPan.x +
          (e.clientX - emCurso.inicioCliente.x) * escala.x,
        y:
          emCurso.inicioPan.y +
          (e.clientY - emCurso.inicioCliente.y) * escala.y,
      });
    }
  }

  // `atual` só limpa se ainda for o mesmo id — evita apagar o foco de um nó
  // que já recebeu hover de novo entre o `onFocoSair` disparar e este rodar.
  function aoSairDoFoco(id: string) {
    setEmFocoId((atual) => {
      if (atual === id) {
        return null;
      }
      return atual;
    });
  }

  function aoSoltarPonteiro() {
    const arraste = arrasteRef.current;
    if (arraste) {
      const atual = overrides[arraste.id] ?? arraste.inicioPos;
      const casa = layout.pos[arraste.id];
      if (distancia(atual, casa) > DISTANCIA_VOLTA_PX) {
        setOverrides((o) => {
          const { [arraste.id]: _removida, ...resto } = o;
          return resto;
        });
      }
      arrasteRef.current = null;
    }
    panRef.current = null;
  }

  // O arraste de nó captura o ponteiro (`setPointerCapture` acima) e continua
  // recebendo `pointermove`/`pointerup` mesmo fora do `<svg>` — `pointerleave`
  // dispara de qualquer jeito (captura não muda essa geometria), mas encerrar
  // o arraste aqui perderia o destino sem motivo. Só a panorâmica do fundo
  // (sem captura) precisa parar quando o ponteiro sai.
  function aoPonteiroSairDoSvg() {
    if (arrasteRef.current) {
      return;
    }
    panRef.current = null;
  }

  return (
    // Focável: clicar no mapa (ou chegar nele por Tab) é o que liga a roda ao
    // pan/zoom. O anel de foco vem do `:focus-visible` global do cosmos.css.
    // `<section>` com nome, não `div`: o leitor de tela anuncia "Mapa de
    // processos, região" ao chegar aqui, em vez de um foco mudo.
    <section
      aria-label="Mapa de processos"
      data-mapa-canvas=""
      ref={canvasRef}
      style={{
        position: "relative",
        width: "100%",
        height: 640,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--hairline)",
        background: "var(--canvas)",
        overflow: "hidden",
        touchAction: "none",
      }}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: o canvas precisa de foco para a roda virar pan/zoom só quando a pessoa o escolheu; Space e Esc já são tratados nele
      tabIndex={0}
    >
      <svg
        height="100%"
        onPointerCancel={aoSoltarPonteiro}
        onPointerDown={iniciarPan}
        onPointerLeave={aoPonteiroSairDoSvg}
        onPointerMove={aoMoverPonteiro}
        onPointerUp={aoSoltarPonteiro}
        ref={svgRef}
        style={{ display: "block", cursor: espaco ? "grab" : "default" }}
        viewBox={`0 0 ${layout.W} ${layout.H}`}
        width="100%"
      >
        <title>Mapa de processos</title>
        <Defs />
        <FundoPontilhado h={layout.H} pan={pan} w={layout.W} />
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <AneisDeNivel aneis={layout.aneis} cx={layout.cx} cy={layout.cy} />
          <Nucleo cx={layout.cx} cy={layout.cy} />
          {grupos.map((g) => (
            <Mancha
              centro={g.centro}
              key={g.dominio}
              nos={g.nos}
              opacidade={opacidadeMancha}
              tom={g.tom}
            />
          ))}
          {grupos.map((g) => (
            <RotuloDominio
              key={g.dominio}
              onSelecionar={() => onSelecionar(g.primeiro)}
              texto={g.rotulo}
              tom={g.tom}
              x={g.centro.x}
              y={g.yRotulo}
            />
          ))}
          {ligacoesVisiveis.map((l) => {
            const de = porId.get(l.deId);
            const para = porId.get(l.paraId);
            if (de === undefined || para === undefined) {
              return null;
            }
            const tocaSelecao =
              selecionado === l.deId || selecionado === l.paraId;
            return (
              <Aresta
                de={posEfetiva(de.id)}
                destacada={tocaSelecao}
                forte={de.dominio !== para.dominio}
                key={l.id}
                para={posEfetiva(para.id)}
                rotulo={l.rotulo}
              />
            );
          })}
          {processos.map((p) => (
            <No
              emFoco={emFocoId === p.id}
              key={p.id}
              onFocoEntrar={() => setEmFocoId(p.id)}
              onFocoSair={() => aoSairDoFoco(p.id)}
              onPointerDown={(e) => iniciarArrasteDoNo(e, p.id)}
              onSelecionar={() => onSelecionar(p.id)}
              p={p}
              pos={posEfetiva(p.id)}
              quente={quente === p.id}
              raio={raiosPorId.get(p.id) ?? 14}
              selecionado={selecionado === p.id}
              status={statusDe(p)}
              tom={tomCss(DOMINIOS[p.dominio].tom)}
            />
          ))}
        </g>
      </svg>
      <p
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          margin: 0,
          fontSize: 10.5,
          color: "var(--ink-faint)",
          pointerEvents: "none",
        }}
      >
        Clique no mapa para navegar com a roda · arrastar um nó é temporário: a
        posição não é salva
      </p>
      <BotaoExportar onExportar={onExportar} />
      <ControlesDeZoom
        onAfastar={afastar}
        onAproximar={aproximar}
        onEnquadrar={enquadrar}
      />
      <Rodape
        arestas={ligacoesVisiveis.length}
        grupos={grupos.length}
        nos={processos.length}
        zoomPercent={Math.round(zoom * 100)}
      />
    </section>
  );
}
