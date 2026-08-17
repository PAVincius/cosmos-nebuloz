"use client";

import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type ShaderMaterial,
} from "three";
import { PAL, type SceneFx } from "./nebula-layers";

/* ════════════════════════════════════════════════════════════
   BLUEPRINT DISC
   ─────────────────────────────────────────────────────────────
   A technical plane laid around the core: concentric hairline
   ellipses, 96 radial ticks, a counter-rotating dashed arc, a
   progress sweep and 12 nodes.

   All of it is one fragment shader on a single plane rather than
   line geometry. Lines of this weight cannot be antialiased —
   at hairline widths they alias into dashes and shimmer as the
   plane turns. Shading it lets every edge come out of `fwidth`,
   so a 1px ellipse stays a clean 1px at any angle.

   Brightness rides the hover wake, so the plan draws itself in
   as the cursor approaches instead of just sitting there.
   ════════════════════════════════════════════════════════════ */

const DISC_TILT: [number, number, number] = [-1.19, 0.14, 0.26];
/** Plane half-extent. The sphere body is r 1.24, so this reads as a table. */
const DISC_RADIUS = 3.15;

const vert = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const frag = /* glsl */ `
  precision highp float;
  uniform float uTime, uWake, uPresence, uRadius;
  uniform vec3 uA, uB, uC;
  varying vec2 vUv;

  #define TAU 6.28318530718

  /* One antialiased ring of radius r and half-width w. */
  float ring(float d, float r, float w){
    float e = fwidth(d) * 0.9 + 1e-5;
    return 1.0 - smoothstep(w, w + e, abs(d - r));
  }

  /* Antialiased wedge mask between two angles (in turns). */
  float band(float t, float from, float to){
    float e = fwidth(t) * 1.4 + 1e-4;
    return smoothstep(from - e, from + e, t) * (1.0 - smoothstep(to - e, to + e, t));
  }

  void main(){
    /* Work in disc space: -1..1 on both axes. */
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p) * uRadius;
    float turn = fract(atan(p.y, p.x) / TAU + 1.0);

    float ink = 0.0;
    vec3 col = vec3(0.0);

    /* ── concentric hairline ellipses ── */
    float rings =
        ring(d, 1.46, 0.004)
      + ring(d, 1.72, 0.0028) * 0.75
      + ring(d, 2.18, 0.004)
      + ring(d, 2.62, 0.0025) * 0.6
      + ring(d, 3.00, 0.0035) * 0.45;
    ink += rings;
    col += uA * rings;

    /* ── 96 radial ticks, every 8th long ── */
    float tickIdx = floor(turn * 96.0);
    float tickPhase = abs(fract(turn * 96.0) - 0.5) * 2.0;
    float tickEdge = fwidth(turn * 96.0) * 2.2 + 1e-4;
    float isTick = 1.0 - smoothstep(1.0 - tickEdge * 6.0, 1.0, tickPhase);
    float longTick = step(0.5, 1.0 - abs(fract(tickIdx / 8.0) - 0.0));
    float tickOuter = 1.82 + longTick * 0.10;
    float tickBand = (1.0 - smoothstep(tickOuter - 0.004, tickOuter, d))
                   * smoothstep(1.72, 1.726, d);
    float ticks = isTick * tickBand * (0.35 + longTick * 0.55);
    ink += ticks;
    col += uB * ticks;

    /* ── counter-rotating dashed arc ── */
    float dashTurn = fract(turn + uTime * 0.035);
    float dashes = step(0.55, fract(dashTurn * 60.0));
    float dashRing = ring(d, 2.40, 0.006);
    float arcWindow = band(fract(turn - uTime * 0.02), 0.05, 0.62);
    float dashed = dashRing * dashes * arcWindow;
    ink += dashed;
    col += uC * dashed;

    /* ── progress sweep: a soft wedge that laps the plate ── */
    float sweep = fract(turn - uTime * 0.055);
    float sweepMask = pow(1.0 - sweep, 6.0);
    float sweepBand = smoothstep(1.40, 1.48, d) * (1.0 - smoothstep(2.16, 2.22, d));
    float sweepInk = sweepMask * sweepBand * 0.20;
    ink += sweepInk;
    col += mix(uA, uC, 0.5) * sweepInk;

    /* ── 12 nodes on the outer ellipse ── */
    float nodeTurn = fract(turn * 12.0);
    float nodeD = length(vec2((nodeTurn - 0.5) * 0.16, (d - 2.18) * 1.0));
    float nodes = 1.0 - smoothstep(0.012, 0.020, nodeD);
    float nodePulse = 0.55 + 0.45 * sin(uTime * 1.6 + floor(turn * 12.0) * 1.7);
    ink += nodes * nodePulse;
    col += uC * nodes * nodePulse * 1.4;

    /* Fade the plate out at its rim so it never shows a hard cut. */
    float edge = 1.0 - smoothstep(2.55, 3.12, d);
    float inner = smoothstep(1.30, 1.44, d);
    float alpha = clamp(ink, 0.0, 1.6) * edge * inner * uPresence * (0.28 + uWake * 0.72);

    if (alpha < 0.002) discard;
    gl_FragColor = vec4(col, alpha);
  }`;

type BlueprintDiscProps = {
  fx: RefObject<SceneFx>;
};

export function BlueprintDisc({ fx }: BlueprintDiscProps) {
  const mat = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWake: { value: 0 },
      uPresence: { value: 0 },
      uRadius: { value: DISC_RADIUS },
      uA: { value: new Color(PAL[0]) },
      uB: { value: new Color(PAL[1]) },
      uC: { value: new Color(PAL[2]) },
    }),
    []
  );

  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) {
      return;
    }
    // R3F 9 copies the `uniforms` prop, so always write through the material.
    const u = m.uniforms;
    u.uTime.value += dt;
    u.uPresence.value = Math.min(fx.current.ringsLevel, 1);
    // aw3 is the last stage of the hover wake — the plan is the outermost
    // structure, so it is the last thing to light up.
    u.uWake.value = fx.current.aw3;
  });

  return (
    <mesh renderOrder={2} rotation={DISC_TILT}>
      <planeGeometry args={[DISC_RADIUS * 2, DISC_RADIUS * 2, 1, 1]} />
      <shaderMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={frag}
        ref={mat}
        side={DoubleSide}
        transparent
        uniforms={uniforms}
        vertexShader={vert}
      />
    </mesh>
  );
}
