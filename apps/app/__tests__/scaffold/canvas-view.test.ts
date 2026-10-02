import { describe, expect, it } from "vitest";
import {
  clampZoom,
  fitView,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  revealDelta,
  zoomAt,
} from "@/lib/scaffold/canvas-view";

// Matemática de pan e zoom do canvas, sem DOM: o componente só liga eventos.

describe("clampZoom", () => {
  it("segura o zoom entre 30% e 200%", () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(1)).toBe(1);
    expect(MIN_ZOOM).toBe(0.3);
    expect(MAX_ZOOM).toBe(2);
  });
});

describe("zoomAt", () => {
  it("mantém parado o ponto do canvas sob o cursor", () => {
    const view = { x: 40, y: 20, k: 1 };
    const next = zoomAt(view, 1.5, 300, 200);
    const before = { x: (300 - view.x) / view.k, y: (200 - view.y) / view.k };
    const after = { x: (300 - next.x) / next.k, y: (200 - next.y) / next.k };
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(next.k).toBeCloseTo(1.5, 6);
  });

  it("não passa dos limites e, no limite, não desloca a vista", () => {
    const view = { x: 10, y: 10, k: MAX_ZOOM };
    expect(zoomAt(view, 2, 100, 100)).toEqual(view);
    const min = { x: 10, y: 10, k: MIN_ZOOM };
    expect(zoomAt(min, 0.5, 100, 100)).toEqual(min);
  });
});

describe("panBy", () => {
  it("desloca a vista sem mexer no zoom", () => {
    expect(panBy({ x: 5, y: 6, k: 0.8 }, 10, -4)).toEqual({
      x: 15,
      y: 2,
      k: 0.8,
    });
  });
});

describe("fitView", () => {
  it("enquadra o desenho inteiro no viewport, centralizado, sem passar sob o controle de zoom", () => {
    const v = fitView({ w: 1000, h: 500 }, { w: 1400, h: 800 });
    expect(v.k).toBeCloseTo(
      Math.min((1400 - 80) / 1000, (800 - 84 - 40) / 500, 1.1)
    );
    expect(v.x).toBeCloseTo((1400 - 1000 * v.k) / 2);
    expect(v.y).toBeGreaterThanOrEqual(84);
  });

  it("nunca amplia além de 110% nem reduz abaixo de 35% ao enquadrar", () => {
    expect(fitView({ w: 100, h: 100 }, { w: 2000, h: 2000 }).k).toBe(1.1);
    expect(fitView({ w: 9000, h: 9000 }, { w: 400, h: 300 }).k).toBe(0.35);
  });
});

describe("revealDelta", () => {
  const viewport = { left: 0, top: 0, right: 800, bottom: 600 };

  it("não mexe quando o elemento já está visível com margem", () => {
    const rect = { left: 100, top: 100, right: 300, bottom: 160 };
    expect(revealDelta(rect, viewport, 40)).toEqual({ dx: 0, dy: 0 });
  });

  it("traz para dentro o que está além da borda, só no eixo que precisa", () => {
    const rect = { left: 700, top: 100, right: 900, bottom: 160 };
    expect(revealDelta(rect, viewport, 40)).toEqual({ dx: -140, dy: 0 });
    const above = { left: 100, top: -50, right: 300, bottom: 10 };
    expect(revealDelta(above, viewport, 40)).toEqual({ dx: 0, dy: 90 });
  });

  it("elemento maior que o viewport é centralizado, em vez de brigar com as duas bordas", () => {
    const rect = { left: -100, top: 0, right: 1000, bottom: 50 };
    expect(revealDelta(rect, viewport, 40).dx).toBe(400 - 450);
  });
});
