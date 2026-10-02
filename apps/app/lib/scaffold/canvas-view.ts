// Pan e zoom do canvas da trilha — só a matemática, sem DOM. O componente liga
// ponteiro, roda e teclado a estas funções; o que entra e sai é sempre uma
// vista nova, nunca a mesma alterada.

export type CanvasViewState = { x: number; y: number; k: number };

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;

const FIT_MIN = 0.35;
const FIT_MAX = 1.1;
const FIT_MARGIN = 80;
/** Topo reservado ao controle de zoom, que flutua sobre o canto da vista. */
const FIT_TOP = 84;

export const clampZoom = (k: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** Zoom em torno de um ponto do viewport: o ponto do desenho sob o cursor não
 *  se mexe. No limite de zoom a vista volta igual, sem deslocar. */
export function zoomAt(
  view: CanvasViewState,
  factor: number,
  cx: number,
  cy: number
): CanvasViewState {
  const k = clampZoom(view.k * factor);
  if (k === view.k) {
    return view;
  }
  const ratio = k / view.k;
  return {
    k,
    x: cx - (cx - view.x) * ratio,
    y: cy - (cy - view.y) * ratio,
  };
}

export const panBy = (
  view: CanvasViewState,
  dx: number,
  dy: number
): CanvasViewState => ({ ...view, x: view.x + dx, y: view.y + dy });

/** "Enquadrar a trilha": o desenho inteiro cabe no viewport, centralizado, sem
 *  ampliar além de 110% (trilha curta não vira cartaz) nem reduzir abaixo de
 *  35% (abaixo disso o texto some). */
export function fitView(
  content: { w: number; h: number },
  viewport: { w: number; h: number }
): CanvasViewState {
  const k = Math.min(
    FIT_MAX,
    Math.max(
      FIT_MIN,
      Math.min(
        (viewport.w - FIT_MARGIN) / content.w,
        (viewport.h - FIT_TOP - FIT_MARGIN / 2) / content.h
      )
    )
  );
  return {
    k,
    x: (viewport.w - content.w * k) / 2,
    y: Math.max(FIT_TOP, (viewport.h - content.h * k) / 2),
  };
}

export type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * Quanto deslocar a vista para trazer um elemento para dentro do viewport,
 * com margem. Zero nos dois eixos quando ele já está visível. Trabalha em
 * coordenadas de tela, então vale igual para clique e para foco por teclado,
 * qualquer que seja o zoom — e nunca muda o zoom, para não desorientar.
 */
export function revealDelta(
  rect: ScreenRect,
  viewport: ScreenRect,
  margin: number
): { dx: number; dy: number } {
  const axis = (lo: number, hi: number, vLo: number, vHi: number) => {
    if (hi - lo > vHi - vLo - margin * 2) {
      return (vLo + vHi) / 2 - (lo + hi) / 2;
    }
    if (lo < vLo + margin) {
      return vLo + margin - lo;
    }
    if (hi > vHi - margin) {
      return vHi - margin - hi;
    }
    return 0;
  };
  return {
    dx: axis(rect.left, rect.right, viewport.left, viewport.right),
    dy: axis(rect.top, rect.bottom, viewport.top, viewport.bottom),
  };
}
