"use client";

import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  type Group,
  Line,
  LineBasicMaterial,
  type Points,
  type PointsMaterial,
  Quaternion,
  Vector3,
} from "three";
import { layerLevel, useSceneSignals } from "./nebula-store";

/* ════════════════════════════════════════════════════════════
   AMBIENT LAYERS — star field, constellation plexus, comets.
   Ported from the design prototype's src/nebula.jsx.

   Plexus and Comets are gated on `fx.plexus`, which the scene
   derives from the assembly progress — not on any external
   signal. Easy to mistake for dead code; they are live.
   ════════════════════════════════════════════════════════════ */

/** Locked palette, in the order the shaders and trails expect. */
export const PAL = ["#5CB4E4", "#89CFF0", "#F6F2C3"] as const;

/** Per-frame scratch shared between the scene body and its layers. */
export type SceneFx = {
  breathT: number;
  lastY: number;
  think: number;
  /** Awake levels: grid, rings+plexus, wires+halo. */
  aw1: number;
  aw2: number;
  aw3: number;
  /** Visibility channel for Plexus + Comets. */
  plexus: number;
  /** Visibility channel shared by the torus rings and their HUD detail. */
  ringsLevel: number;
  shockT: number | null;
  /** Decaying 0–1 envelope after a click; drives the bloom surge. */
  shockEnv: number;
};

export const createSceneFx = (): SceneFx => ({
  breathT: 0,
  lastY: 0,
  think: 0,
  aw1: 0,
  aw2: 0,
  aw3: 0,
  plexus: 0,
  ringsLevel: 0,
  shockT: null,
  shockEnv: 0,
});

/** Five thin elliptical rings, independent tilts and spins. `c` indexes PAL. */
export const RINGS = [
  {
    r: 2.05,
    tilt: [Math.PI / 2.3, 0.3, 0] as const,
    op: 0.42,
    spin: [0, 0, 0.075] as const,
    c: 0,
  },
  {
    r: 2.55,
    tilt: [Math.PI / 2, -0.55, 0.38] as const,
    op: 0.24,
    spin: [0.045, 0, 0] as const,
    c: 2,
  },
  {
    r: 3.15,
    tilt: [Math.PI / 1.75, 0.28, -0.42] as const,
    op: 0.15,
    spin: [0, 0.055, 0] as const,
    c: 1,
  },
  {
    r: 3.85,
    tilt: [Math.PI / 3, 0.7, 0.22] as const,
    op: 0.1,
    spin: [0, 0, -0.034] as const,
    c: 0,
  },
  {
    r: 4.7,
    tilt: [Math.PI / 2.8, -0.45, -0.6] as const,
    op: 0.065,
    spin: [0, -0.06, 0] as const,
    c: 2,
  },
];

/* ── star field ───────────────────────────────────────────── */

const STAR_COUNT = 1500;

export function StarField() {
  const signals = useSceneSignals();
  const ref = useRef<Points<BufferGeometry, PointsMaterial>>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    const col = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 16 + Math.sqrt(Math.random()) * 46;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      const b = 0.14 + Math.random() * 0.7;
      col[i * 3] = b;
      col[i * 3 + 1] = b * 0.97;
      col[i * 3 + 2] = b;
    }
    return [pos, col];
  }, []);

  useFrame(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.rotation.y += 0.000_05;
    node.rotation.x += 0.000_016;
    node.material.opacity = 0.7 * layerLevel(signals.current, "stars");
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
        <bufferAttribute args={[colors, 3]} attach="attributes-color" />
      </bufferGeometry>
      <pointsMaterial
        depthWrite={false}
        opacity={0.7}
        size={0.035}
        sizeAttenuation
        transparent
        vertexColors
      />
    </points>
  );
}

/* ── mouse-parallax camera ────────────────────────────────── */

/** The prototype also carried a `window.__nzCam` per-section framing branch.
 *  Only the v2 narrative page ever set it, so this is the legacy branch only. */
export function CameraRig() {
  const signals = useSceneSignals();

  useFrame(({ camera }) => {
    const [nx, ny] = signals.current.ndc;
    const tx = nx * 0.34;
    const ty = ny * 0.22;
    camera.position.x += (tx - camera.position.x) * 0.045;
    camera.position.y += (ty - camera.position.y) * 0.045;
    camera.position.z += (6.2 - camera.position.z) * 0.045;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ── constellation plexus ─────────────────────────────────── */

const NODES = 72;
const MAX_LINKS = 240;
const LINK = 0.78;

type PlexusNode = {
  r: number;
  th: number;
  ph: number;
  sTh: number;
  sPh: number;
  seed: number;
};

type PlexusData = {
  list: PlexusNode[];
  pos: Float32Array;
  lpos: Float32Array;
  lcol: Float32Array;
};

type LayerProps = {
  fx: RefObject<SceneFx>;
  /** Node budget; the mid tier runs a sparser field. */
  nodes?: number;
};

/** Advances each node along its own slow orbit. */
function stepNodes(data: PlexusData, t: number, dt: number, quick: number) {
  const { list, pos } = data;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    n.th += n.sTh * dt * quick;
    n.ph += n.sPh * dt * quick;
    const r = n.r + Math.sin(t * 0.3 + n.seed) * 0.06;
    const sp = Math.sin(n.ph);
    pos[i * 3] = sp * Math.cos(n.th) * r;
    pos[i * 3 + 1] = Math.cos(n.ph) * r * 0.92;
    pos[i * 3 + 2] = sp * Math.sin(n.th) * r;
  }
}

/** Links every pair within LINK of each other, brightest when closest.
 *  Returns the number of links written. */
function buildLinks(data: PlexusData): number {
  const { list, pos, lpos, lcol } = data;
  const limit = LINK * LINK;
  let k = 0;
  for (let i = 0; i < list.length && k < MAX_LINKS; i++) {
    for (let j = i + 1; j < list.length && k < MAX_LINKS; j++) {
      const dx = pos[i * 3] - pos[j * 3];
      const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
      const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > limit) {
        continue;
      }
      const f = 1 - Math.sqrt(d2) / LINK;
      const o = k * 6;
      lpos[o] = pos[i * 3];
      lpos[o + 1] = pos[i * 3 + 1];
      lpos[o + 2] = pos[i * 3 + 2];
      lpos[o + 3] = pos[j * 3];
      lpos[o + 4] = pos[j * 3 + 1];
      lpos[o + 5] = pos[j * 3 + 2];
      lcol[o] = f;
      lcol[o + 1] = f;
      lcol[o + 2] = f;
      lcol[o + 3] = f;
      lcol[o + 4] = f;
      lcol[o + 5] = f;
      k += 1;
    }
  }
  return k;
}

export function Plexus({ fx, nodes = NODES }: LayerProps) {
  const signals = useSceneSignals();
  const rootRef = useRef<Group>(null);
  const pointsMat = useRef<PointsMaterial>(null);
  const lineMat = useRef<LineBasicMaterial>(null);

  const data = useMemo<PlexusData>(() => {
    const list: PlexusNode[] = Array.from({ length: nodes }, () => ({
      r: 1.5 + Math.random() * 0.95,
      th: Math.random() * Math.PI * 2,
      ph: Math.acos(2 * Math.random() - 1),
      sTh: (Math.random() - 0.5) * 0.11,
      sPh: (Math.random() - 0.5) * 0.055,
      seed: Math.random() * 10,
    }));
    return {
      list,
      pos: new Float32Array(nodes * 3),
      lpos: new Float32Array(MAX_LINKS * 6),
      lcol: new Float32Array(MAX_LINKS * 6),
    };
  }, [nodes]);

  const built = useMemo(() => {
    const pointsGeo = new BufferGeometry();
    pointsGeo.setAttribute("position", new BufferAttribute(data.pos, 3));
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute("position", new BufferAttribute(data.lpos, 3));
    lineGeo.setAttribute("color", new BufferAttribute(data.lcol, 3));
    lineGeo.setDrawRange(0, 0);
    return { lineGeo, pointsGeo };
  }, [data]);

  useFrame(({ clock }, dt) => {
    const vis = fx.current.plexus * layerLevel(signals.current, "wires");
    if (rootRef.current) {
      rootRef.current.visible = vis >= 0.01;
    }
    if (vis < 0.01) {
      return;
    }
    stepNodes(data, clock.elapsedTime, dt, 1 + fx.current.think * 1.4);
    const k = buildLinks(data);

    built.pointsGeo.attributes.position.needsUpdate = true;
    built.lineGeo.attributes.position.needsUpdate = true;
    built.lineGeo.attributes.color.needsUpdate = true;
    built.lineGeo.setDrawRange(0, k * 2);

    const aw = fx.current.aw2;
    if (pointsMat.current) {
      pointsMat.current.opacity = vis * (0.5 + aw * 0.4);
    }
    if (lineMat.current) {
      lineMat.current.opacity = vis * (0.16 + aw * 0.2);
    }
  });

  return (
    <group ref={rootRef} renderOrder={2}>
      <points frustumCulled={false} geometry={built.pointsGeo}>
        <pointsMaterial
          blending={AdditiveBlending}
          color={PAL[2]}
          depthWrite={false}
          opacity={0}
          ref={pointsMat}
          size={0.028}
          sizeAttenuation
          transparent
        />
      </points>
      <lineSegments frustumCulled={false} geometry={built.lineGeo}>
        <lineBasicMaterial
          blending={AdditiveBlending}
          color={PAL[1]}
          depthWrite={false}
          opacity={0}
          ref={lineMat}
          transparent
          vertexColors
        />
      </lineSegments>
    </group>
  );
}

/* ── comets — slow orbiters leaving a short fading trail ──── */

const COMETS = 9;
const TRAIL = 18;

const rnd2 = (a: number, b: number) => a + Math.random() * (b - a);

type Comet = {
  rx: number;
  rz: number;
  ry: number;
  speed: number;
  phase: number;
  tilt: Quaternion;
  trail: Float32Array;
  colors: Float32Array;
  seeded: boolean;
};

export function Comets({ fx }: Pick<LayerProps, "fx">) {
  const signals = useSceneSignals();
  const rootRef = useRef<Group>(null);

  const comets = useMemo<Comet[]>(
    () =>
      Array.from({ length: COMETS }, (_unused, i) => {
        const tilt = new Quaternion().setFromEuler(
          new Euler(rnd2(-0.9, 0.9), rnd2(0, Math.PI), rnd2(-0.5, 0.5))
        );
        const trail = new Float32Array(TRAIL * 3);
        const colors = new Float32Array(TRAIL * 3);
        const c = new Color(PAL[i % 3]);
        for (let k = 0; k < TRAIL; k++) {
          const f = (1 - k / (TRAIL - 1)) ** 1.6;
          colors[k * 3] = c.r * f;
          colors[k * 3 + 1] = c.g * f;
          colors[k * 3 + 2] = c.b * f;
        }
        return {
          rx: rnd2(1.7, 3.1),
          rz: rnd2(1.7, 3.1),
          ry: rnd2(0.5, 1.1),
          speed: rnd2(0.1, 0.3) * (i % 2 ? 1 : -1),
          phase: rnd2(0, 6.28),
          tilt,
          trail,
          colors,
          seeded: false,
        };
      }),
    []
  );

  const lines = useMemo(
    () =>
      comets.map((cm) => {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(cm.trail, 3));
        geometry.setAttribute("color", new BufferAttribute(cm.colors, 3));
        const material = new LineBasicMaterial({
          blending: AdditiveBlending,
          depthWrite: false,
          opacity: 0,
          transparent: true,
          vertexColors: true,
        });
        const line = new Line(geometry, material);
        line.frustumCulled = false;
        return line;
      }),
    [comets]
  );

  const scratch = useMemo(() => new Vector3(), []);

  useFrame(({ clock }) => {
    const vis = fx.current.plexus * layerLevel(signals.current, "wires");
    if (rootRef.current) {
      rootRef.current.visible = vis >= 0.01;
    }
    if (vis < 0.01) {
      return;
    }
    const t = clock.elapsedTime;
    for (const [i, cm] of comets.entries()) {
      const a = t * cm.speed + cm.phase;
      scratch
        .set(
          cm.rx * Math.cos(a),
          cm.ry * Math.sin(a * 0.68),
          cm.rz * Math.sin(a)
        )
        .applyQuaternion(cm.tilt);
      const tr = cm.trail;
      if (!cm.seeded) {
        for (let k = 0; k < TRAIL; k++) {
          tr[k * 3] = scratch.x;
          tr[k * 3 + 1] = scratch.y;
          tr[k * 3 + 2] = scratch.z;
        }
        cm.seeded = true;
      }
      tr.copyWithin(3, 0, (TRAIL - 1) * 3);
      tr[0] = scratch.x;
      tr[1] = scratch.y;
      tr[2] = scratch.z;
      const line = lines[i];
      line.geometry.attributes.position.needsUpdate = true;
      line.material.opacity = vis * 0.55;
    }
  });

  return (
    <group ref={rootRef} renderOrder={3}>
      {lines.map((line) => (
        <primitive key={line.uuid} object={line} />
      ))}
    </group>
  );
}
