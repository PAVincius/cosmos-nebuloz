"use client";

// "Abrir no canvas": a trilha como diagrama, em diálogo de tela cheia, só leitura.
// Port de `scaffold-track-canvas.jsx` sem o copiloto (PR B e C, parados por
// decisão: D-26, LGPD item 3 de 01/10, parecer de voz). Nada aqui grava, não há
// permissão própria e não há posição salva — o desenho sai do método.

import { Button, IconButton } from "@repo/design-system/cosmos/kit";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { TrackDetail } from "@/app/(scaffold)/actions/tracks";
import { layoutTrack } from "@/lib/scaffold/canvas-layout";
import {
  type CanvasViewState,
  fitView,
  panBy,
  revealDelta,
  zoomAt,
} from "@/lib/scaffold/canvas-view";
import { STATUS } from "@/lib/scaffold/deliverable-labels";
import { PHASE } from "@/lib/scaffold/phases";
import type { DeliverableItem } from "./deliverable-list";
import type { CanvasSel } from "./track-canvas-model";
import { CanvasPanel } from "./track-canvas-panel";
import { CanvasWorld } from "./track-canvas-world";

const TWEEN_MS = 320; // teto do DESIGN.md: 450ms
const ARROW_STEP = 60;
const NARROW = 720;
const PANEL_W = 340;
const FOCUSABLE =
  'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function TrackCanvas({
  track,
  deliverables,
  onClose,
  onOpenPhase,
}: {
  track: TrackDetail;
  deliverables: DeliverableItem[];
  onClose: () => void;
  onOpenPhase: (phase: string) => void;
}) {
  const layout = useMemo(
    () => layoutTrack(track.phases, deliverables),
    [track.phases, deliverables]
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement | null>(null);
  // 0x0 até medir: nada enquadra (nem decide "estreito") antes de saber o tamanho.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<CanvasViewState>({ x: 40, y: 84, k: 0.8 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const raf = useRef(0);
  const [sel, setSel] = useState<CanvasSel | null>(null);
  const pan = useRef<{
    x: number;
    y: number;
    v: CanvasViewState;
    moved: boolean;
  } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const narrow = size.w > 0 && size.w < NARROW;

  const animateTo = useCallback((to: CanvasViewState) => {
    cancelAnimationFrame(raf.current);
    if (reducedMotion()) {
      setView(to);
      return;
    }
    const from = viewRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / TWEEN_MS);
      const e = 1 - (1 - t) ** 4;
      setView({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        k: from.k + (to.k - from.k) * e,
      });
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
      }
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const frameTrack = useCallback(
    (animate = true) => {
      // O painel cobre um pedaço do viewport; o desenho enquadra no que sobra.
      const avail = {
        w: size.w - (narrow ? 0 : PANEL_W + 24),
        h: size.h - (narrow ? size.h * 0.46 : 0),
      };
      const base = fitView(layout, avail);
      // Desenho mais largo que a tela (zoom mínimo): começa pela primeira fase,
      // em vez de cortar as duas pontas.
      const to = layout.w * base.k > avail.w ? { ...base, x: 16 } : base;
      if (animate) {
        animateTo(to);
      } else {
        setView(to);
      }
    },
    [layout, size, narrow, animateTo]
  );

  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && size.w > 100) {
      fitted.current = true;
      frameTrack(false);
    }
  }, [size, frameTrack]);

  // Foco: entra no diálogo, e devolve ao botão que o abriu ao sair.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      cancelAnimationFrame(raf.current);
      opener?.focus?.();
    };
  }, []);

  // Medida do viewport e roda (zoom em torno do cursor), presas ao elemento pelo
  // ref: acompanham o elemento que está de fato na tela, mesmo se o React o
  // remontar (Strict Mode, portal). A roda é listener nativo e não passivo: o
  // `onWheel` do React é passivo e `preventDefault` seria ignorado.
  const unbind = useRef<(() => void) | null>(null);
  const setViewport = useCallback((el: HTMLDivElement | null) => {
    unbind.current?.();
    unbind.current = null;
    vpRef.current = el;
    if (!el) {
      return;
    }
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(raf.current);
      const r = el.getBoundingClientRect();
      setView((v) =>
        zoomAt(
          v,
          Math.exp(-e.deltaY * 0.0015),
          e.clientX - r.left,
          e.clientY - r.top
        )
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    unbind.current = () => {
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, []);

  const zoomBy = (factor: number) =>
    animateTo(zoomAt(viewRef.current, factor, size.w / 2, size.h / 2));

  // Traz à vista o que foi clicado ou focado, sem mexer no zoom. O painel cobre
  // um pedaço do viewport; o que ele cobre não conta como "à vista".
  const reveal = useCallback(
    (el: HTMLElement) => {
      const vp = vpRef.current?.getBoundingClientRect();
      if (!vp) {
        return;
      }
      const r = el.getBoundingClientRect();
      const { dx, dy } = revealDelta(
        { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        {
          left: vp.left,
          top: vp.top + 56,
          right: vp.right - (narrow ? 0 : PANEL_W + 24),
          bottom: vp.bottom - (narrow ? size.h * 0.46 : 0),
        },
        24
      );
      if (dx !== 0 || dy !== 0) {
        animateTo(panBy(viewRef.current, dx, dy));
      }
    },
    [animateTo, narrow, size.h]
  );

  const select = (s: CanvasSel, el: HTMLElement) => {
    setSel(s);
    reveal(el);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    cancelAnimationFrame(raf.current);
    pan.current = {
      x: e.clientX,
      y: e.clientY,
      v: viewRef.current,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) {
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      p.moved = true;
      setGrabbing(true);
    }
    if (p.moved) {
      setView(panBy(p.v, dx, dy));
    }
  };
  const onPointerUp = () => {
    // Clique no vazio (sem arrasto) limpa a seleção.
    if (pan.current && !pan.current.moved) {
      setSel(null);
    }
    pan.current = null;
    setGrabbing(false);
  };

  const onViewportKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      return;
    }
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [ARROW_STEP, 0],
      ArrowRight: [-ARROW_STEP, 0],
      ArrowUp: [0, ARROW_STEP],
      ArrowDown: [0, -ARROW_STEP],
    };
    const a = arrows[e.key];
    if (a) {
      e.preventDefault();
      setView((v) => panBy(v, a[0], a[1]));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.25);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomBy(0.8);
    } else if (e.key === "0") {
      e.preventDefault();
      frameTrack();
    }
  };

  // Esc fecha; Tab fica preso no diálogo (aria-modal não prende o foco sozinho).
  const onDialogKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) {
      return;
    }
    const items = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ];
    const first = items[0];
    const last = items.at(-1);
    if (!(first && last)) {
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const counts = Object.entries(STATUS)
    .map(([k, v]) => ({
      key: k,
      ...v,
      n: deliverables.filter(
        (d) => d.status === k && d.dispensedReason === null
      ).length,
    }))
    .filter((s) => s.n > 0);
  const dispensed = deliverables.filter((d) => d.dispensedReason !== null);

  const host =
    document.querySelector<HTMLElement>(".scaffold-root") ?? document.body;

  return createPortal(
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Esc e Tab do diálogo modal; o foco preso é do próprio diálogo
    <div
      aria-label={`Canvas da trilha ${track.code}`}
      aria-modal="true"
      className="fade-in"
      onKeyDown={onDialogKey}
      ref={dialogRef}
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "grid",
        gridTemplateRows: "56px minmax(0, 1fr)",
        background: "var(--canvas)",
        color: "var(--ink)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 16px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--sidebar)",
          minWidth: 0,
        }}
      >
        <Button
          icon="arrowLeft"
          onClick={onClose}
          size="sm"
          variant="secondary"
        >
          Voltar à trilha
        </Button>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {track.processName}
          </span>
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-faint)" }}
          >
            {track.code} · {track.templateLabel} · fase{" "}
            {PHASE[track.currentPhase].label}
          </span>
        </div>
        {narrow ? null : (
          <ul
            aria-label="Entregáveis por estado"
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {counts.map((s) => (
              <li
                key={s.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: `var(--${s.tone})`,
                  }}
                />
                {s.label}
                <span className="mono" style={{ color: "var(--ink-faint)" }}>
                  {s.n}
                </span>
              </li>
            ))}
            {dispensed.length > 0 ? (
              <li
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: "var(--neutral)",
                  }}
                />
                Dispensado
                <span className="mono" style={{ color: "var(--ink-faint)" }}>
                  {dispensed.length}
                </span>
              </li>
            ) : null}
          </ul>
        )}
      </header>

      {/* biome-ignore lint/a11y/useSemanticElements: região do desenho, navegável por teclado */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: setas, mais, menos e zero movem a vista */}
      <div
        aria-label="Área do desenho. Setas movem a vista, mais e menos aproximam e afastam, zero enquadra a trilha."
        onKeyDown={onViewportKey}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={setViewport}
        role="group"
        style={{
          position: "relative",
          overflow: "hidden",
          cursor: grabbing ? "grabbing" : "grab",
          touchAction: "none",
          backgroundImage:
            "radial-gradient(var(--hairline-strong) 1px, transparent 1px)",
          backgroundSize: `${22 * view.k}px ${22 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a região precisa de foco para receber o teclado
        tabIndex={0}
      >
        <div
          onFocusCapture={(e) => reveal(e.target as HTMLElement)}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: layout.w,
            height: layout.h,
            transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`,
            transformOrigin: "0 0",
          }}
        >
          <CanvasWorld
            deliverables={deliverables}
            layout={layout}
            onSelect={select}
            sel={sel}
            track={track}
          />
        </div>

        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 16,
            top: 16,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 4,
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            border: "1px solid var(--hairline-strong)",
            boxShadow: "var(--card-shadow)",
            zIndex: 4,
          }}
        >
          <IconButton
            name="plus"
            onClick={() => zoomBy(1.25)}
            size={30}
            title="Aproximar"
          />
          <IconButton
            name="minus"
            onClick={() => zoomBy(0.8)}
            size={30}
            title="Afastar"
          />
          <IconButton
            name="maximize"
            onClick={() => frameTrack()}
            size={30}
            title="Enquadrar a trilha"
          />
          <span
            aria-live="polite"
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--ink-faint)",
              padding: "0 6px",
            }}
          >
            {Math.round(view.k * 100)}%
          </span>
        </div>

        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            top: narrow ? "auto" : 12,
            left: narrow ? 12 : "auto",
            width: narrow ? "auto" : PANEL_W,
            maxHeight: narrow ? "44%" : "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: narrow ? "flex-end" : "flex-start",
            zIndex: 4,
            cursor: "default",
          }}
        >
          <CanvasPanel
            deliverables={deliverables}
            layout={layout}
            onOpenPhase={onOpenPhase}
            onSelect={(s) => setSel(s)}
            sel={sel}
            track={track}
          />
        </div>
      </div>
    </div>,
    host
  );
}
