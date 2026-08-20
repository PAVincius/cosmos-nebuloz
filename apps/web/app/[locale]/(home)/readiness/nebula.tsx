"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  ChromaticAberration,
  EffectComposer,
  FXAA,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, BloomEffect } from "postprocessing";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  type Group,
  MathUtils,
  type Mesh,
  type MeshBasicMaterial,
  type ShaderMaterial,
  Vector3,
} from "three";
import { BlueprintDisc } from "./nebula-hud";
import {
  CameraRig,
  Comets,
  createSceneFx,
  PAL,
  Plexus,
  RINGS,
  type SceneFx,
  StarField,
} from "./nebula-layers";
import {
  BODY_FRAG,
  DUST_FRAG,
  DUST_VERT,
  ENERGY_FRAG,
  HALO_FRAG,
  SPHERE_VERT,
  WAVE_FRAG,
} from "./nebula-shaders";
import { Sharpen } from "./nebula-sharpen";
import { layerLevel, type SceneSignals, useSceneSignals } from "./nebula-store";
import { type NebulaTier, type Tier, tierNebula } from "./scene-gate";

/* ════════════════════════════════════════════════════════════
   NEBULA — the Nebuloz brand sphere.

   Layer stack, inside → out, each gated on assembly progress:
     · dust cloud, ignites core-outward, sectors driven by uAxes
     · dark glass BODY (writes depth — genuinely occludes dust)
     · FBM energy skin + ripple-wave shell (additive)
     · lat/long grid shell + the HUD dial
     · fresnel halo + five thin rings, independent spins
     · constellation plexus + comet trails · distant star field
   Post: Bloom · ChromaticAberration · Vignette · FXAA.
   Never Glitch — permanently banned by the brand rules.
   ════════════════════════════════════════════════════════════ */

const DUST_R_MAX = 2.9;
const BODY_RADIUS = 1.24;
/* The halo shell. Paired with HALO_FRAG's RIM constant, which is
   atan(BODY_RADIUS / 6.2) / atan(HALO_RADIUS / 6.2) — change either radius, or
   the camera's z in the Canvas below, and RIM has to follow. */
const HALO_RADIUS = 1.78;

type ShellUniforms = {
  uTime: { value: number };
  uPresence: { value: number };
  uHit: { value: number };
  uEnergy: { value: number };
  uMouseL: { value: Vector3 };
  uCenter: { value: Vector3 };
  uA: { value: Color };
  uB: { value: Color };
  uC: { value: Color };
};

type DustUniforms = {
  uTime: { value: number };
  uBuild: { value: number };
  uSize: { value: number };
  uPixelRatio: { value: number };
  /** View-space distance of the focal plane. */
  uFocus: { value: number };
  /** How far off the plane a point must sit to defocus fully. */
  uAperture: { value: number };
  /** Maximum sprite growth factor for a fully defocused point. */
  uMaxCoc: { value: number };
  /** In-focus grain size in px — the real size control (see DUST_VERT). */
  uMaxSize: { value: number };
  uAxes: { value: Float32Array };
  uAxisFocus: { value: number };
  uLayer: { value: number };
  uBreath: { value: number };
  uThink: { value: number };
  uMagStr: { value: number };
  uMagnet: { value: Vector3 };
  uShock: { value: number };
  uShockPt: { value: Vector3 };
};

const makeShellUniforms = (): ShellUniforms => ({
  uTime: { value: 0 },
  uPresence: { value: 0 },
  uHit: { value: 0 },
  uEnergy: { value: 0 },
  uMouseL: { value: new Vector3(0, 0, 1) },
  uCenter: { value: new Vector3(0, 0, 0) },
  uA: { value: new Color(PAL[0]) },
  uB: { value: new Color(PAL[1]) },
  uC: { value: new Color(PAL[2]) },
});

function buildDust(count: number, pixelRatioCap: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const activate = new Float32Array(count);
  const seed = new Float32Array(count);
  const radius = new Float32Array(count);
  const sector = new Float32Array(count);
  const cCore = new Color("#FBF4CB");
  const cMid = new Color(PAL[0]);
  const cOut = new Color("#8FB6EE");

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = Math.min(
      (0.1 + Math.random() ** 1.3 * 2.6) * (0.7 + 0.6 * Math.random() ** 2),
      DUST_R_MAX
    );
    positions[i * 3] =
      Math.sin(phi) * Math.cos(theta) * r + (Math.random() - 0.5) * 0.16;
    positions[i * 3 + 1] =
      Math.sin(phi) * Math.sin(theta) * r + (Math.random() - 0.5) * 0.16;
    positions[i * 3 + 2] = Math.cos(phi) * r + (Math.random() - 0.5) * 0.16;

    const rn = Math.min(r / DUST_R_MAX, 1);
    radius[i] = rn;
    activate[i] = Math.min(1, rn ** 0.85 * (0.5 + 0.55 * Math.random()));
    seed[i] = Math.random();
    // Five sectors around the polar axis, one per readiness axis.
    sector[i] = Math.floor(((theta / (Math.PI * 2)) % 1) * 5);

    const col =
      rn < 0.3
        ? cCore.clone().lerp(cMid, rn / 0.3)
        : cMid.clone().lerp(cOut, (rn - 0.3) / 0.7);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
  geometry.setAttribute("aActivate", new BufferAttribute(activate, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
  geometry.setAttribute("aRadius", new BufferAttribute(radius, 1));
  geometry.setAttribute("aSector", new BufferAttribute(sector, 1));

  const uniforms: DustUniforms = {
    uTime: { value: 0 },
    uBuild: { value: 0 },
    // Pre-clamp scale. Saturates in practice — uMaxSize is the real control.
    uSize: { value: 10.5 },
    uPixelRatio: {
      value: Math.min(
        typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
        pixelRatioCap
      ),
    },
    // Seeded to the default camera-to-sphere distance; the frame loop tracks
    // the real one from here, so it survives the offsetX drift and any zoom.
    uFocus: { value: 6.2 },
    uAperture: { value: 2.6 },
    uMaxCoc: { value: 3.4 },
    // In-focus grain size in px. The prototype's effective size was 8; this is
    // a tenth of it, so the field reads as grain. Defocused points still open
    // up to uMaxSize * (1 + uMaxCoc) for the bokeh discs.
    uMaxSize: { value: 0.8 },
    uAxes: { value: new Float32Array([0.4, 0.4, 0.4, 0.4, 0.4]) },
    uAxisFocus: { value: -1 },
    uLayer: { value: 1 },
    uBreath: { value: 0 },
    uThink: { value: 0 },
    uMagStr: { value: 0 },
    uMagnet: { value: new Vector3(0, 0, 1.45) },
    uShock: { value: -1 },
    uShockPt: { value: new Vector3(0, 0, BODY_RADIUS) },
  };

  return { geometry, uniforms };
}

/** Reusable vectors, so the frame loop never allocates. */
type Scratch = {
  ray: Vector3;
  origin: Vector3;
  centre: Vector3;
  hit: Vector3;
  localHit: Vector3;
};

/**
 * Everything the frame loop touches, in one object built once at mount.
 * `dt`, `hit` and `signals` are re-stamped at the top of each frame, so every
 * update helper below takes the rig and at most two extra arguments.
 */
type Rig = {
  body: ShellUniforms;
  dt: number;
  dust: DustUniforms;
  energy: ShellUniforms;
  fx: SceneFx;
  halo: ShellUniforms;
  hit: number;
  scratch: Scratch;
  shells: ShellUniforms[];
  signals: SceneSignals;
  wave: ShellUniforms;
};

/** Cursor-on-water: ray × sphere proximity, and the nearest surface point. */
function updateTouch(rig: Rig, camera: Camera, presence: number) {
  const { scratch: s, dt } = rig;
  const from = camera.position;
  s.ray.set(rig.signals.ndc[0], rig.signals.ndc[1], 0.5).unproject(camera);
  s.ray.sub(from).normalize();
  s.origin.copy(from).sub(s.centre);
  const along = s.origin.dot(s.ray);
  const perpendicular = Math.sqrt(
    Math.max(s.origin.lengthSq() - along * along, 0)
  );
  const strength =
    MathUtils.smoothstep(1.9 - Math.min(perpendicular, 1.9), 0, 0.65) *
    presence;
  s.origin
    .copy(from)
    .addScaledVector(s.ray, -along)
    .sub(s.centre)
    .normalize()
    .multiplyScalar(BODY_RADIUS);
  s.hit.lerp(s.origin, Math.min(dt * 9, 1));
  rig.hit += (strength - rig.hit) * Math.min(dt * 5, 1);
}

/** Breathing, scroll-velocity "thinking", and the three staggered wake levels. */
function updateStates(rig: Rig) {
  const { fx, dust, dt } = rig;
  fx.breathT += dt;
  // 20s idle cycle
  dust.uBreath.value = Math.sin(((fx.breathT % 20) / 20) * Math.PI * 2);

  const scrollY = window.scrollY;
  const velocity = Math.abs(scrollY - fx.lastY) / Math.max(dt, 1e-3);
  fx.lastY = scrollY;
  fx.think += (Math.min(velocity / 2600, 1) - fx.think) * Math.min(dt * 2.5, 1);
  dust.uThink.value = fx.think;

  const on = rig.hit > 0.12 ? 1 : 0;
  fx.aw1 += (on - fx.aw1) * Math.min(dt * 3.2, 1); // grid wakes first
  fx.aw2 += (fx.aw1 - fx.aw2) * Math.min(dt * 1.8, 1); // rings + plexus
  fx.aw3 += (fx.aw2 - fx.aw3) * Math.min(dt * 1.1, 1); // wires + halo, last
}

/** Click shockwave. Fires only when the cursor is geometrically on the sphere. */
function updateShock(rig: Rig): number {
  const { fx, dust, signals, scratch, dt } = rig;
  if (signals.shockPending) {
    signals.shockPending = false;
    if (rig.hit > 0.08) {
      fx.shockT = 0;
      dust.uShockPt.value
        .copy(scratch.localHit)
        .normalize()
        .multiplyScalar(BODY_RADIUS);
    }
  }
  if (fx.shockT === null) {
    fx.shockEnv = 0;
    return 0;
  }
  fx.shockT += dt;
  if (fx.shockT > 2.4) {
    fx.shockT = null;
    dust.uShock.value = -1;
    fx.shockEnv = 0;
    return 0;
  }
  dust.uShock.value = fx.shockT;
  fx.shockEnv = Math.exp(-fx.shockT * 3.2);
  return fx.shockEnv;
}

/** Eases the five axis values toward whatever the quiz published. */
function updateAxes(rig: Rig): void {
  const current = rig.dust.uAxes.value;
  for (let i = 0; i < 5; i++) {
    current[i] +=
      (rig.signals.axes[i] - current[i]) * Math.min(rig.dt * 2.2, 1);
  }
  rig.dust.uAxisFocus.value = rig.signals.axisFocus;
}

/** Presence, hit and energy across the four shells plus the dust layer. */
function updateShells(rig: Rig, presence: number, shockEnv: number): void {
  const { body, energy, wave, halo, dust, fx, scratch, signals: s, dt } = rig;
  for (const u of [body, energy, wave]) {
    u.uTime.value += dt;
  }
  body.uPresence.value = presence * layerLevel(s, "body");
  energy.uPresence.value = presence * layerLevel(s, "energy");
  wave.uPresence.value = presence * layerLevel(s, "waves");
  halo.uPresence.value = presence * layerLevel(s, "halo");
  dust.uLayer.value = layerLevel(s, "dust");
  body.uHit.value = rig.hit;
  energy.uHit.value = rig.hit;
  body.uEnergy.value = s.energy + fx.think * 0.45 + shockEnv * 0.9;
  body.uMouseL.value.copy(scratch.hit);
  energy.uMouseL.value.copy(scratch.hit);
}

/**
 * The lat/long grid on the body, plus the Plexus visibility channel.
 *
 * The two icosahedron wireframes the prototype drew at r 1.62 / 1.88 are gone:
 * the HUD dial now owns that band, and stacking both read as a tangle rather
 * than as structure.
 */
function updateGrid(
  rig: Rig,
  wires: number,
  grid: MeshBasicMaterial | null
): void {
  const { fx, signals: s } = rig;
  if (grid) {
    grid.opacity = wires * 0.05 * layerLevel(s, "grid") * (1 + fx.aw1 * 2.4);
  }
  fx.plexus = wires * layerLevel(s, "dust");
}

/** R3F hands back the generic Mesh type from a JSX ref callback, so the
 *  material is `Material | Material[]` and gets narrowed at use. */
type RingMesh = Mesh | null;

/** Ring opacity and spin — scroll energy feeds both. */
function updateRings(rig: Rig, rings: number, meshes: RingMesh[]): void {
  const { fx, signals: s, dt } = rig;
  const level = layerLevel(s, "rings");
  const spin = dt * (1 + fx.aw2 * 0.6);
  // Published so the HUD detail rides the same curve as the rings it annotates.
  fx.ringsLevel = rings * (1 + s.energy * 0.5 + fx.aw2 * 0.7) * level;
  for (const [i, mesh] of meshes.entries()) {
    if (!mesh || Array.isArray(mesh.material)) {
      continue;
    }
    const spec = RINGS[i];
    mesh.material.opacity =
      rings * spec.op * (1 + s.energy * 0.5 + fx.aw2 * 0.7) * level;
    mesh.rotation.x += spec.spin[0] * spin;
    mesh.rotation.y += spec.spin[1] * spin;
    mesh.rotation.z += spec.spin[2] * spin;
  }
}

type SceneProps = {
  fxRef: RefObject<SceneFx>;
  tier: NebulaTier;
};

function NebulaScene({ fxRef, tier }: SceneProps) {
  const signals = useSceneSignals();
  const rootRef = useRef<Group>(null);
  const groupRef = useRef<Group>(null);
  const gridMat = useRef<MeshBasicMaterial>(null);
  const ringRefs = useRef<RingMesh[]>([]);
  const smooth = useRef(0);
  const dustMat = useRef<ShaderMaterial>(null);
  const bodyMat = useRef<ShaderMaterial>(null);
  const energyMat = useRef<ShaderMaterial>(null);
  const waveMat = useRef<ShaderMaterial>(null);
  const haloMat = useRef<ShaderMaterial>(null);

  const { geometry, uniforms: dust } = useMemo(
    () => buildDust(tier.count, tier.pixelRatioCap),
    [tier.count, tier.pixelRatioCap]
  );

  const rig = useMemo<Rig>(() => {
    const body = makeShellUniforms();
    const energy = makeShellUniforms();
    const wave = makeShellUniforms();
    const halo = makeShellUniforms();
    return {
      body,
      dt: 0,
      dust,
      energy,
      fx: fxRef.current,
      halo,
      hit: 0,
      scratch: {
        ray: new Vector3(),
        origin: new Vector3(),
        centre: new Vector3(),
        hit: new Vector3(0, 0, 1),
        localHit: new Vector3(),
      },
      shells: [body, energy, wave, halo],
      signals: signals.current,
      wave,
    };
  }, [dust, signals, fxRef]);

  /* R3F 9 does NOT keep the object passed to `uniforms=` — it hands three a copy,
     so `material.uniforms.uBuild` is a different object from the one built above.
     Writing to the originals updates nothing: uBuild stays 0, every point
     collapses to 24% of its rest radius, and all four shells sit at uPresence 0.
     (This worked in the prototype because R3F 8 assigned by reference.)

     Rebind the rig to the live objects once the materials exist. useLayoutEffect
     so it lands before the first useFrame. */
  useLayoutEffect(() => {
    const live = <T,>(ref: RefObject<ShaderMaterial | null>, fallback: T): T =>
      (ref.current?.uniforms as T | undefined) ?? fallback;
    rig.dust = live(dustMat, rig.dust);
    rig.body = live(bodyMat, rig.body);
    rig.energy = live(energyMat, rig.energy);
    rig.wave = live(waveMat, rig.wave);
    rig.halo = live(haloMat, rig.halo);
    rig.shells = [rig.body, rig.energy, rig.wave, rig.halo];
  }, [rig]);

  // Dev-only inspection handle. The design prototype exposed `window.__forceBuild`
  // for the same reason — there is no other way to read shader uniforms from
  // outside once R3F stops publishing its store on the canvas element.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    w.__nz = { dust, dustMat, geometry, rig, signals };
    return () => {
      w.__nz = undefined;
    };
  }, [dust, geometry, rig, signals]);

  useFrame(({ camera }, dt) => {
    const s = signals.current;
    rig.dt = dt;
    rig.signals = s;
    const { scratch } = rig;

    // Drift channel — the page can re-centre the whole sphere.
    if (
      rootRef.current &&
      Math.abs(rootRef.current.position.x - s.offsetX) > 1e-4
    ) {
      rootRef.current.position.x +=
        (s.offsetX - rootRef.current.position.x) * Math.min(dt * 2.2, 1);
      const cx = rootRef.current.position.x;
      scratch.centre.x = cx;
      for (const u of rig.shells) {
        u.uCenter.value.x = cx;
      }
    }

    // Ease the build so scrubbing feels weighty, not twitchy.
    smooth.current += (s.build - smooth.current) * Math.min(dt * 2.4, 0.1);
    const b = smooth.current;
    const presence = MathUtils.smoothstep(b, 0.22, 0.7);
    const wires = MathUtils.smoothstep(b, 0.34, 0.72);
    const rings = MathUtils.smoothstep(b, 0.46, 0.85);

    updateTouch(rig, camera, presence);
    updateStates(rig);

    // Cursor hit point in the rotating group's local frame.
    scratch.localHit.copy(scratch.hit);
    if (groupRef.current) {
      scratch.localHit.applyQuaternion(
        groupRef.current.quaternion.clone().invert()
      );
    }
    rig.dust.uMagnet.value
      .copy(scratch.localHit)
      .normalize()
      .multiplyScalar(1.45);
    rig.dust.uMagStr.value = rig.hit;

    const shockEnv = updateShock(rig);

    rig.dust.uTime.value += dt;
    rig.dust.uBuild.value = b;
    // Focus rides the live camera-to-sphere distance, so the sphere stays the
    // sharp subject while the dust in front of and behind it opens up.
    rig.dust.uFocus.value = camera.position.distanceTo(scratch.centre);
    updateAxes(rig);
    updateShells(rig, presence, shockEnv);
    updateGrid(rig, wires, gridMat.current);
    updateRings(rig, rings, ringRefs.current);

    if (groupRef.current) {
      groupRef.current.rotation.y +=
        dt * (0.03 + presence * 0.02 + s.energy * 0.05);
      groupRef.current.rotation.x =
        Math.sin(performance.now() * 0.000_05) * 0.1;
    }
  });

  return (
    <group ref={rootRef}>
      <StarField />
      <group ref={groupRef}>
        {/* body — writes depth, so it occludes the dust behind it */}
        <mesh renderOrder={1}>
          <sphereGeometry
            args={[BODY_RADIUS, tier.bodySegments, tier.bodySegments]}
          />
          <shaderMaterial
            depthTest
            depthWrite
            fragmentShader={BODY_FRAG}
            ref={bodyMat}
            transparent
            uniforms={rig.body}
            vertexShader={SPHERE_VERT}
          />
        </mesh>
        {/* energy wisps */}
        <mesh renderOrder={2}>
          <sphereGeometry
            args={[1.253, tier.energySegments, tier.energySegments]}
          />
          <shaderMaterial
            blending={AdditiveBlending}
            depthWrite={false}
            fragmentShader={ENERGY_FRAG}
            ref={energyMat}
            transparent
            uniforms={rig.energy}
            vertexShader={SPHERE_VERT}
          />
        </mesh>
        {/* expanding ripple waves — nine acos per fragment, dropped on mid */}
        {tier.waveShell ? (
          <mesh renderOrder={2}>
            <sphereGeometry args={[1.27, 72, 72]} />
            <shaderMaterial
              blending={AdditiveBlending}
              depthWrite={false}
              fragmentShader={WAVE_FRAG}
              ref={waveMat}
              transparent
              uniforms={rig.wave}
              vertexShader={SPHERE_VERT}
            />
          </mesh>
        ) : null}
        {/* lat/long grid on the body. The prototype's two icosahedron
            wireframes at r 1.62 / 1.88 are gone — the blueprint disc owns
            that band now. */}
        <mesh renderOrder={2}>
          <sphereGeometry args={[1.252, 26, 18]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={PAL[1]}
            depthWrite={false}
            opacity={0}
            ref={gridMat}
            transparent
            wireframe
          />
        </mesh>
        {/* The halo. 1.78 rather than the 1.30 it was: against a body at 1.24
            that gave the falloff ten screen pixels to happen in, so it could
            only ever read as a plate with an edge. This is the width the fade
            lives in — HALO_FRAG's RIM constant is derived from it and from
            BODY_RADIUS, so the two move together. Cheap to grow: 1.8x the
            fragments of a fifteen-op shader, no noise, no loops. */}
        <mesh renderOrder={3}>
          <sphereGeometry
            args={[HALO_RADIUS, tier.haloSegments, tier.haloSegments]}
          />
          <shaderMaterial
            blending={AdditiveBlending}
            depthWrite={false}
            fragmentShader={HALO_FRAG}
            ref={haloMat}
            transparent
            uniforms={rig.halo}
            vertexShader={SPHERE_VERT}
          />
        </mesh>
        {/* five rings — independent tilts and spins */}
        {RINGS.map((ring, i) => (
          <mesh
            key={ring.r}
            ref={(el) => {
              ringRefs.current[i] = el;
            }}
            renderOrder={3}
            rotation={ring.tilt}
          >
            <torusGeometry args={[ring.r, i === 0 ? 0.005 : 0.0035, 8, 240]} />
            <meshBasicMaterial
              blending={AdditiveBlending}
              color={PAL[ring.c]}
              depthWrite={false}
              opacity={0}
              transparent
            />
          </mesh>
        ))}
        {/* dust — depth-tested against the body */}
        <points geometry={geometry} renderOrder={0}>
          <shaderMaterial
            blending={AdditiveBlending}
            depthTest
            depthWrite={false}
            fragmentShader={DUST_FRAG}
            ref={dustMat}
            transparent
            uniforms={dust}
            vertexShader={DUST_VERT}
          />
        </points>
        <Plexus fx={fxRef} nodes={tier.plexusNodes} />
      </group>
      {/* Technical plan laid around the core. Outside the rotating group so it
          keeps its own plane while the sphere turns inside it. */}
      <BlueprintDisc fx={fxRef} />
      {tier.comets ? <Comets fx={fxRef} /> : null}
    </group>
  );
}

type ReadinessNebulaProps = {
  label: string;
  tier: Tier;
};

export function ReadinessNebula({ label, tier }: ReadinessNebulaProps) {
  const config = useMemo(() => tierNebula(tier), [tier]);
  // Lifted out of NebulaScene so the bloom driver, which lives beside the
  // composer, can read the same wake and shock channels the scene writes.
  const fxRef = useRef<SceneFx>(createSceneFx());

  /* Constructed directly rather than via <Bloom ref=…>. The JSX wrappers go
     through postprocessing's `wrapEffect`, which memoises on
     JSON.stringify(props) — and under React 19 `ref` arrives inside props, so
     the serialisation hits the effect object and throws on a circular
     structure. Owning the instances also lets the driver below mutate
     `intensity` per frame without a re-render. */
  const blooms = useMemo(
    () => ({
      /* Matches the design's single pass exactly (intensity 1.35, smoothing
         0.58, radius 0.78). The tighter 0.42/0.55 this replaced made the rim
         crisper but needed a hotter intensity to carry any halo, and that is
         what the surge was compensating for. */
      tight: new BloomEffect({
        intensity: config.bloom,
        luminanceSmoothing: 0.58,
        luminanceThreshold: 0,
        mipmapBlur: true,
        radius: 0.78,
      }),
      wide: new BloomEffect({
        intensity: config.bloomWide,
        luminanceSmoothing: 0.7,
        luminanceThreshold: 0,
        mipmapBlur: true,
        radius: 0.95,
      }),
    }),
    [config.bloom, config.bloomWide]
  );

  // EffectComposer v3 types its children as `JSX.Element | JSX.Element[]`, so a
  // bare `cond && <X/>` (which evaluates to `false`) will not typecheck. An
  // array built up front keeps the mid tier's dropped pass out of the chain
  // without a wrapper fragment.
  const effects = [
    /* Two bloom passes rather than one hotter pass. A tight one keeps the rim
       reading as a crisp edge; a wide one carries the halo out into the black
       the way the references do. Both intensities are driven per-frame by
       BloomDriver below. */
    <primitive key="bloom-tight" object={blooms.tight} />,
    <primitive key="bloom-wide" object={blooms.wide} />,
    ...(config.chroma
      ? [
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            key="chroma"
            modulationOffset={0.24}
            offset={[0.0011, 0.0011]}
            radialModulation
          />,
        ]
      : []),
    /* After bloom, before vignette: recovers the edges bloom softened. */
    ...(config.sharpen > 0
      ? [<Sharpen key="sharpen" strength={config.sharpen} />]
      : []),
    <Vignette
      blendFunction={BlendFunction.MULTIPLY}
      darkness={0.7}
      eskil={false}
      key="vignette"
      offset={0.22}
    />,
    /* FXAA only where there is no MSAA. It is a post-hoc edge blur that works on
       the final image, so stacking it on top of real multisampling just softens
       detail the sharpen pass then tries to recover. */
    ...(config.multisampling === 0 ? [<FXAA key="fxaa" />] : []),
  ];

  return (
    <Canvas
      aria-label={label}
      camera={{ fov: 46, position: [0, 0, 6.2] }}
      dpr={config.dpr}
      /* `antialias: false` on purpose. With an EffectComposer in the chain the
         scene never renders to the default framebuffer — it renders into the
         composer's own render targets — so context-level MSAA is bypassed
         entirely while still making the browser allocate a multisampled
         framebuffer nobody reads. The antialiasing that actually applies is
         `multisampling` on EffectComposer below. */
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      }}
      role="img"
      // R3F binds pointer handlers to the canvas; without this a fixed
      // inset-0 canvas swallows every click on the nav, footer and cards.
      style={{ pointerEvents: "none" }}
    >
      <NebulaScene fxRef={fxRef} tier={config} />
      <CameraRig />
      <BloomDriver base={config} blooms={blooms} fx={fxRef} />
      {/* Real MSAA on the composer target, which is what the rings, the
          lat/long grid and the wireframes needed — they are thin bright lines
          on near-black, the worst case for aliasing, and FXAA smears them
          instead of resolving them. */}
      <EffectComposer multisampling={config.multisampling}>
        {effects}
      </EffectComposer>
    </Canvas>
  );
}

type BloomDriverProps = {
  base: NebulaTier;
  blooms: { tight: BloomEffect; wide: BloomEffect };
  fx: RefObject<SceneFx>;
};

/**
 * Lifts the bloom as the cursor approaches the sphere and again on click.
 *
 * Renders nothing — it exists to write `intensity` on the two bloom effects
 * every frame. `aw1` is the first stage of the hover wake, so the glow answers
 * the cursor immediately; `shockEnv` is the decaying click envelope.
 *
 * The two passes respond very differently on purpose. The tight pass only
 * touches pixels that are already bright, so pulsing it reads as the rim
 * flaring — that is the click. The wide pass smears light across the whole
 * frame, so it must stay almost still: driving it too meant a tap washed the
 * entire viewport grey (measured 1.90 on the wide pass alone against the
 * design's single static 1.35, with the tight pass at 3.16 on top). It answers
 * the cursor faintly and ignores the click completely.
 *
 * The click still lands hard where it should — `updateShells` pushes
 * `shockEnv * 0.9` into the body's own energy, and the dust ring rides
 * `uShock`. Both are the design's behaviour; the bloom surge never was.
 */
function BloomDriver({ base, blooms, fx }: BloomDriverProps) {
  useFrame(() => {
    const f = fx.current;
    blooms.tight.intensity = base.bloom * (1 + f.aw1 * 0.15 + f.shockEnv * 0.4);
    blooms.wide.intensity = base.bloomWide * (1 + f.aw1 * 0.3);
  });
  return null;
}
