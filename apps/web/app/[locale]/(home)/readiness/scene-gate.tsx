"use client";

import { useEffect, useState } from "react";

/* ════════════════════════════════════════════════════════════
   SCENE GATE
   ─────────────────────────────────────────────────────────────
   Deliberately not `SceneMount` from (home)/nebuloz: that helper
   ANDs an in-view test (meaningless for a layer that is
   `fixed inset-0` and therefore always in view) with
   `!document.hidden`, which UNMOUNTS the Canvas on tab-away. On
   return the whole scene would rebuild and re-assemble from
   zero. rAF is already suspended in a hidden tab, so nothing
   needs to be done there — and `frameloop="never"` is not the
   answer either: R3F's setFrameloop calls
   `clock.stop(); clock.elapsedTime = 0`, which would snap every
   noise field in the shaders.

   The gate lives OUTSIDE the dynamic() boundary on purpose. Put
   it inside and an incapable device still downloads three,
   @react-three/fiber and postprocessing before the component
   returns null.
   ════════════════════════════════════════════════════════════ */

export type Tier = "high" | "mid";

/** Same predicates as nebuloz/scene-mount.tsx's detectCapable, minus the
 *  in-view test. Re-implemented rather than imported so that file — which
 *  carries pre-existing lint errors — stays untouched. */
function detectCapable(): boolean {
  const mm = (query: string) => window.matchMedia(query).matches;
  if (mm("(prefers-reduced-motion: reduce)")) {
    return false;
  }
  /* Any touch-primary device, at any width and in either orientation.
     This used to be `coarse && (max-width: 820px)`, which tests the VIEWPORT —
     so every phone in landscape above 820px slipped through, along with the
     whole iPad range. Measured: iPhone 14 Pro Max landscape (926×428), iPad Air
     11 (834), iPad Pro (1024) and iPad mini landscape (1133) all mounted the
     Canvas and pulled the 1,117,121-byte three.js chunk over mobile data. The
     hardware floors below never caught them either — Safari does not expose
     `deviceMemory`, so it falls through to the `?? 8` default.
     The scene has no useful touch affordance anyway: hover wake and the click
     shockwave are pointer gestures. */
  if (mm("(pointer: coarse)")) {
    return false;
  }
  // A narrow desktop window is not worth a full WebGL scene either.
  if (window.innerWidth < 1024) {
    return false;
  }
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores >= 4 && memory >= 4;
}

function detectTier(): Tier {
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores >= 8 && memory >= 8 ? "high" : "mid";
}

/** One-shot capability decision. Starts false so SSR and the first client
 *  render agree, then flips on mount if the device can carry the scene. */
export function useNebulaMount(): { mount: boolean; tier: Tier } {
  const [state, setState] = useState<{ mount: boolean; tier: Tier }>({
    mount: false,
    tier: "mid",
  });

  useEffect(() => {
    setState({ mount: detectCapable(), tier: detectTier() });
  }, []);

  return state;
}

export type NebulaTier = {
  bloom: number;
  /** Second, wider bloom pass — carries the halo out into the black. */
  bloomWide: number;
  bodySegments: number;
  chroma: boolean;
  comets: boolean;
  count: number;
  dpr: [number, number];
  energySegments: number;
  /** MSAA samples on the EffectComposer target. 0 falls back to an FXAA pass. */
  multisampling: number;
  pixelRatioCap: number;
  plexusNodes: number;
  /** Unsharp-mask strength after bloom; 0 skips the pass entirely. */
  sharpen: number;
  waveShell: boolean;
};

/**
 * The cost here is not the particles — 11k points with a ~32-op vertex shader is
 * trivial. It is four overlapping full-shell fragment programs covering the
 * whole viewport (the layer is fixed, not a hero box), plus mipmap-blur bloom.
 * `waveFrag` alone runs nine `acos` per fragment, so the mid tier drops it first.
 */
export function tierNebula(tier: Tier): NebulaTier {
  if (tier === "high") {
    return {
      // The design ships one static Bloom at 1.35; this is that pass.
      bloom: 1.35,
      /* A second, wider pass the design does not have. It exists only to carry
         a little halo past the rim into the black — at 0.45 it was hazing the
         glass body into a pale ball even at rest, which is the opposite of the
         dark-glass reference. Kept low enough to read as air around the sphere
         rather than as fog over the page. */
      bloomWide: 0.16,
      bodySegments: 96,
      chroma: true,
      comets: true,
      count: 16_000,
      dpr: [1, 1.5],
      energySegments: 80,
      /* 0, with the FXAA pass doing the antialiasing — which is what the design
         ships and what this scene needs.
         4× MSAA was tried here and produced a visible regression: the comet
         heads blew out into hard white discs orbiting the sphere. The trails
         use AdditiveBlending with depthWrite off, so their contribution
         accumulates; resolving that accumulation per-sample pushed it past 1.0,
         and both bloom passes run at luminanceThreshold 0, so anything past 1.0
         becomes pure white. FXAA was not hiding a defect — it was the correct
         pass for a pipeline that composites additively. */
      multisampling: 0,
      pixelRatioCap: 1.5,
      plexusNodes: 72,
      sharpen: 0.55,
      waveShell: true,
    };
  }
  return {
    bloom: 1.1,
    bloomWide: 0.12,
    bodySegments: 64,
    chroma: false,
    comets: false,
    count: 6500,
    dpr: [1, 1.25],
    energySegments: 56,
    // No MSAA here — the FXAA pass covers it at a fraction of the fill rate.
    multisampling: 0,
    pixelRatioCap: 1.25,
    plexusNodes: 48,
    // The mid tier is already paying for two bloom passes; skip the extra pass.
    sharpen: 0,
    waveShell: false,
  };
}

/** Static stand-in wherever the Canvas is skipped. No animation — it has to
 *  satisfy prefers-reduced-motion, which is one of the reasons it shows. */
export function ReadinessOrbFallback() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(38% 42% at 66% 44%, var(--c-violet), transparent 62%), radial-gradient(24% 26% at 70% 50%, var(--c-cyan), transparent 55%)",
        filter: "blur(40px)",
        opacity: 0.18,
      }}
    />
  );
}
