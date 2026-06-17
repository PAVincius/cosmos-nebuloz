"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/* ════════════════════════════════════════════════════════════
   NEBULA — built from scratch.
   A single granular particle cloud. Nothing else in the scene:
   no stars, no rings, no wisps. Pure points + bloom.

   It assembles with `build` (0 → 1):
     · build ≈ 0   one faint spark at the centre
     · build rises  points emerge from the core outward, granular
     · build ≈ 1   a dense, glowing nebula — a soft ball of light

   Particles are ordered by radius: the core ignites first, the
   halo last, so growth always reads from the inside out.
   ════════════════════════════════════════════════════════════ */

const COUNT = 9000;

const vert = /* glsl */ `
  uniform float uTime, uBuild, uSize, uPixelRatio;
  attribute float aActivate, aSeed, aRadius;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  // cheap hash noise for organic wobble
  float hash(float n){ return fract(sin(n) * 43758.5453); }

  void main(){
    // activation front — soft edge so points twinkle in
    float edge = 0.10;
    float vis = smoothstep(aActivate - edge, aActivate + edge, uBuild);

    // emerge FROM the core: inactive points sit near centre,
    // then travel out to their resting place as they ignite
    vec3 rest = position;
    vec3 p = mix(rest * 0.22, rest, smoothstep(0.0, 1.0, vis));

    // slow breathing drift for life
    float t = uTime * 0.25 + aSeed * 6.2831;
    p += vec3(sin(t), cos(t * 0.9), sin(t * 1.1)) * 0.018 * (0.4 + aRadius);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float depth = -mv.z;
    float twinkle = 0.75 + 0.4 * sin(uTime * 1.4 + aSeed * 30.0);
    gl_PointSize = uSize * (0.35 + vis) * (0.55 + 0.9 * aSeed) * twinkle
                 * (220.0 / depth) * uPixelRatio;
    gl_PointSize = clamp(gl_PointSize, 0.0, 8.0 * uPixelRatio);

    vColor = aColor;
    // halo fades out at the rim; core stays bright
    vAlpha = vis * mix(0.85, 0.14, smoothstep(0.2, 1.0, aRadius));
  }`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.05, 0.5, d);
    gl_FragColor = vec4(vColor, soft * vAlpha * 0.7);
  }`;

interface NebulaPointsProps {
  buildRef: React.MutableRefObject<number>;
}

function NebulaPoints({ buildRef }: NebulaPointsProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const ptsRef = useRef<THREE.Points>(null);

  const { geometry, uniforms } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const activate = new Float32Array(COUNT);
    const seed = new Float32Array(COUNT);
    const radius = new Float32Array(COUNT);

    // palette — cream-hot core → sky blue → soft indigo halo
    const cCore = new THREE.Color("#FBF4CB");
    const cMid = new THREE.Color("#5CB4E4");
    const cOut = new THREE.Color("#8FB6EE");

    const R_MAX = 2.7;
    for (let i = 0; i < COUNT; i++) {
      const u = Math.random(),
        v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);

      // diffuse, sparse spread — a dust cloud, not a composed ball
      const rBase = Math.random() ** 1.3;
      const clump = 0.7 + 0.6 * Math.random() ** 2.0;
      let r = (0.1 + rBase * 2.5) * clump;
      r = Math.min(r, R_MAX);

      let x = Math.sin(phi) * Math.cos(theta) * r;
      let y = Math.sin(phi) * Math.sin(theta) * r;
      let z = Math.cos(phi) * r;
      // granular jitter
      x += (Math.random() - 0.5) * 0.16;
      y += (Math.random() - 0.5) * 0.16;
      z += (Math.random() - 0.5) * 0.16;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const rn = Math.min(r / R_MAX, 1);
      radius[i] = rn;
      // core ignites first; jitter keeps the front grainy, not a clean ring
      activate[i] = Math.min(1, rn ** 0.85 * (0.5 + 0.55 * Math.random()));
      seed[i] = Math.random();

      const col =
        rn < 0.32
          ? cCore.clone().lerp(cMid, rn / 0.32)
          : cMid.clone().lerp(cOut, (rn - 0.32) / 0.68);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aActivate", new THREE.BufferAttribute(activate, 1));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));

    const uniforms = {
      uTime: { value: 0 },
      uBuild: { value: 0 },
      uSize: { value: 10.5 },
      uPixelRatio: {
        value: Math.min(
          (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
          1.5
        ),
      },
    };
    return { geometry, uniforms };
  }, []);

  const smooth = useRef(0);
  useFrame((_, dt) => {
    // window.__forceBuild lets a screenshot pin the nebula to a build value
    const w =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : {};
    const target =
      typeof w.__forceBuild === "number" ? w.__forceBuild : buildRef.current;
    // ease the build so scrubbing feels weighty, not twitchy
    smooth.current += (target - smooth.current) * Math.min(dt * 2.4, 0.1);
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += dt;
      matRef.current.uniforms.uBuild.value = smooth.current;
    }
    if (ptsRef.current) {
      ptsRef.current.rotation.y += dt * 0.035;
      ptsRef.current.rotation.x = Math.sin(performance.now() * 0.000_06) * 0.12;
    }
  });

  return (
    <points geometry={geometry} ref={ptsRef}>
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        fragmentShader={frag}
        ref={matRef}
        transparent
        uniforms={uniforms}
        vertexShader={vert}
      />
    </points>
  );
}

interface NebulaProps {
  buildRef: React.MutableRefObject<number>;
}

export function Nebula({ buildRef }: NebulaProps) {
  return (
    <Canvas
      aria-label="An animated nebula of light that assembles from a single spark into a dense cloud"
      camera={{ position: [0, 0, 6.2], fov: 46 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      role="img"
    >
      <NebulaPoints buildRef={buildRef} />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.0}
          luminanceSmoothing={0.6}
          luminanceThreshold={0.0}
          mipmapBlur
          radius={0.7}
        />
        <Vignette
          blendFunction={BlendFunction.MULTIPLY}
          darkness={0.7}
          eskil={false}
          offset={0.22}
        />
      </EffectComposer>
    </Canvas>
  );
}
