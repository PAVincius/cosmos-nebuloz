"use client";

import type { ReactNode, RefObject } from "react";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";

/* ════════════════════════════════════════════════════════════
   SCENE SIGNALS
   ─────────────────────────────────────────────────────────────
   The design prototype passed ten values from React into the
   WebGL scene through `window.__nz*` globals, because the two
   lived in separate script files. Here they are one typed
   object behind a context, so a key typo is a type error.

   The context carries a stable ref, never state: the hero's rAF
   loop writes `build` / `energy` / `offsetX` at 60 fps, and
   putting those in state would re-render the whole Canvas
   subtree every frame.

   R3F 9 bridges React context across the Canvas reconciler
   (`useBridge()` → its-fine), so a provider mounted outside
   <Canvas> is visible to components inside it. drei's
   useContextBridge is not needed.
   ════════════════════════════════════════════════════════════ */

export type LayerKey =
  | "stars"
  | "body"
  | "energy"
  | "waves"
  | "halo"
  | "dust"
  | "grid"
  | "wires"
  | "rings";

export type SceneSignals = {
  /** Assembly progress, 0 → 1. Written by the hero's rAF loop. */
  build: number;
  /** Overall intensity: quiet mid-page, surging at the CTA. */
  energy: number;
  /** World-space X the sphere is composed around. */
  offsetX: number;
  /** Readiness axes, one per sector: data, process, people, governance, infra. */
  axes: [number, number, number, number, number];
  /** Sector currently being answered, or -1 for none. */
  axisFocus: number;
  /** Per-layer opacity multipliers; absent keys mean 1. */
  layers: Partial<Record<LayerKey, number>>;
  /** Pointer in NDC, y up. One listener feeds both the camera and the sphere. */
  ndc: [number, number];
  /** Set on pointerdown; the scene consumes it to fire one shockwave. */
  shockPending: boolean;
};

/** The value `axes` holds before the quiz is touched — a middling shape. */
export const AXES_NEUTRAL: SceneSignals["axes"] = [0.4, 0.4, 0.4, 0.4, 0.4];

export const createSceneSignals = (): SceneSignals => ({
  build: 0,
  energy: 0,
  offsetX: 0,
  axes: [...AXES_NEUTRAL] as SceneSignals["axes"],
  axisFocus: -1,
  layers: {},
  /* Off-screen, not [0, 0]. NDC origin is the centre of the viewport, which is
     close enough to the sphere that the hover wake reads as fully on from the
     first frame — the grid, rings and bloom all sit at their woken level and
     the surge has nothing to surge from. Starting outside the frustum means
     the scene is calm until the pointer actually approaches. */
  ndc: [-10, -10],
  shockPending: false,
});

const SceneSignalsCtx = createContext<RefObject<SceneSignals> | null>(null);

/** Non-null in the readiness tree; the scene is only ever mounted inside it. */
export function useSceneSignals(): RefObject<SceneSignals> {
  const ref = useContext(SceneSignalsCtx);
  if (!ref) {
    throw new Error(
      "useSceneSignals must be used inside <SceneSignalsProvider>"
    );
  }
  return ref;
}

/** Reads a layer multiplier, defaulting to fully on. */
export const layerLevel = (
  signals: SceneSignals,
  key: LayerKey,
  fallback = 1
): number => signals.layers[key] ?? fallback;

type SceneSignalsProviderProps = {
  children: ReactNode;
};

export function SceneSignalsProvider({ children }: SceneSignalsProviderProps) {
  const ref = useRef<SceneSignals>(createSceneSignals());
  // Stable identity: the ref object never changes, so no consumer re-renders.
  const value = useMemo(() => ref, []);

  // One pointer listener for the whole scene. The prototype registered two —
  // one in its camera rig, one in the scene body.
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      ref.current.ndc = [
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      ];
    };
    const onPointerDown = () => {
      ref.current.shockPending = true;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <SceneSignalsCtx.Provider value={value}>
      {children}
    </SceneSignalsCtx.Provider>
  );
}
