"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  FXAA,
  Glitch,
  GodRays,
  HueSaturation,
  Noise,
  Pixelation,
  Scanline,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, GlitchMode, KernelSize } from "postprocessing";
import type React from "react";
import {
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { PaletteCtx, WebGLCtx } from "./contexts";

/* ── Core fresnel+FBM shader ─────────────────────── */
const coreVert = /* glsl */ `
  varying vec3 vNormal; varying vec3 vWorldPos; varying vec3 vView;
  void main(){
    vNormal=normalize(normalMatrix*normal);
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    vView=normalize(-mv.xyz);
    vWorldPos=(modelMatrix*vec4(position,1.0)).xyz;
    gl_Position=projectionMatrix*mv;
  }`;
const coreFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uA,uB,uC; uniform float uIntensity,uAlpha;
  varying vec3 vNormal,vWorldPos,vView;
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=.5;}return v;}
  void main(){
    float fres=pow(1.-clamp(dot(vNormal,vView),0.,1.),2.8);
    vec3 q=vWorldPos*1.5+vec3(0.,uTime*.04,uTime*.06);
    float n=fbm(q),n2=fbm(q*2.1+n);
    vec3 col=mix(uA,uB,smoothstep(.3,.75,n2));col=mix(col,uC,smoothstep(.6,.9,n));
    col=mix(col*.12,col,fres)+fres*uC*.65;
    gl_FragColor=vec4(col*uIntensity,clamp((.5+fres*.65)*uAlpha,0.,1.));
  }`;

/* ── Nebula wisp dome shader ─────────────────────── */
const wispVert = /* glsl */ `
  varying vec3 vWorldPos;
  void main(){vWorldPos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `;
const wispFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uA,uB; varying vec3 vWorldPos;
  float hash(float n){return fract(sin(n)*43758.5453);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float n=i.x+i.y*57.+113.*i.z;
    return mix(mix(mix(hash(n),hash(n+1.),f.x),mix(hash(n+57.),hash(n+58.),f.x),f.y),
               mix(mix(hash(n+113.),hash(n+114.),f.x),mix(hash(n+170.),hash(n+171.),f.x),f.y),f.z);}
  float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p*=2.;a*=.5;}return v;}
  void main(){
    vec3 q=normalize(vWorldPos)*2.1+vec3(uTime*.008,uTime*.006,uTime*.01);
    float n2=fbm(q*2.2+fbm(q)*.85);
    gl_FragColor=vec4(mix(uA,uB,smoothstep(.3,.82,fbm(q))),smoothstep(.44,.7,n2)*.22);
  }`;

/* ── Water ripple dome shader ────────────────────── */
const rippleVert = /* glsl */ `
  varying vec3 vWorldPos;
  void main(){
    vWorldPos=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }`;
const rippleFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uA,uB;
  varying vec3 vWorldPos;
  float hash(float n){return fract(sin(n)*43758.5453);}
  vec2 hash2(float n){return vec2(hash(n),hash(n+1.2345));}
  void main(){
    vec3 p=normalize(vWorldPos);
    float total=0.;
    for(int i=0;i<9;i++){
      float fi=float(i);
      vec2 h=hash2(fi*17.3+4.5);
      float theta=h.x*6.2832;
      float phi=acos(clamp(2.*h.y-1.,-1.,1.));
      vec3 src=vec3(sin(phi)*cos(theta),sin(phi)*sin(theta),cos(phi));
      float dist=acos(clamp(dot(p,src),-0.9999,0.9999));
      float offset=hash(fi*23.7);
      float t=mod(uTime*.52+offset*4.,4.2);
      float front=dist-t*.62;
      float ring=exp(-front*front*45.)*smoothstep(0.,.18,t)*smoothstep(4.2,1.8,t);
      total+=ring;
    }
    vec3 col=mix(uA,uB,clamp(total,0.,1.));
    gl_FragColor=vec4(col,clamp(total*.12,0.,.10));
  }`;

/* ── Inner sphere — metallic glass + proximity glow ── */
const innerVert = /* glsl */ `
  varying vec3 vNormal; varying vec3 vWorldPos; varying vec3 vView;
  void main(){
    vNormal=normalize(normalMatrix*normal);
    vec4 mv=modelViewMatrix*vec4(position,1.);
    vView=normalize(-mv.xyz);
    vWorldPos=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*mv;
  }`;
const innerFrag = /* glsl */ `
  uniform float uTime,uOpacity; uniform vec3 uA,uB;
  uniform sampler2D uParticles;
  varying vec3 vNormal,vWorldPos,vView;
  float hash(float n){return fract(sin(n)*43758.5453);}
  void main(){
    vec3 p=normalize(vWorldPos);
    float fres=pow(1.-clamp(dot(vNormal,vView),0.,1.),3.2);
    /* metallic glass base */
    vec3 col=mix(vec3(.008,.010,.016),uA*.06,fres*fres);
    col+=fres*uA*.28+fres*uB*.10;
    /* specular */
    vec3 refl=reflect(-vView,vNormal);
    float spec=pow(max(dot(refl,normalize(vec3(.4,.9,1.6))),0.),32.);
    col+=spec*mix(uA,uB,.5)*.22;
    /* particle proximity glow — 16 samples */
    float glow=0.;
    for(int i=0;i<16;i++){
      float fi=float(i);
      vec2 uv=vec2(fract(fi*.0625+uTime*.009),fract(fi*.041+uTime*.006));
      vec3 pp=texture2D(uParticles,uv).xyz;
      float rp=length(pp);
      if(rp>.6&&rp<1.3){
        float d=length(normalize(pp)-p);
        glow+=exp(-d*d*22.)*.14;
      }
    }
    col+=glow*uA*.55;
    /* 4 subtle pre-baked ripples */
    float ripple=0.;
    for(int i=0;i<4;i++){
      float fi=float(i);
      float th=hash(fi*3.1)*6.2832,ph=hash(fi*7.3)*3.14159;
      vec3 src=vec3(sin(ph)*cos(th),sin(ph)*sin(th),cos(ph));
      float dist=acos(clamp(dot(p,src),-1.,1.));
      float t=mod(uTime*.38+hash(fi*17.)* 3.8,3.8);
      float front=dist-t*.65;
      ripple+=exp(-front*front*60.)*smoothstep(3.8,1.,t)*smoothstep(0.,.12,t)*.28;
    }
    col+=ripple*mix(uA,uB,.6)*.7;
    float alpha=(fres*.52+.04+glow*.28+ripple*.18)*uOpacity;
    gl_FragColor=vec4(col,clamp(alpha,0.,.78));
  }`;

/* ── GPGPU simulation shaders ────────────────────── */
const simVert = /* glsl */ `
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}
  `;
const simFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uPositions,uOriginal;
  uniform float uTime,uDt,uStrength;
  varying vec2 vUv;
  float hash(float n){return fract(sin(n)*43758.5453);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float n=i.x+i.y*57.+113.*i.z;
    return mix(mix(mix(hash(n),hash(n+1.),f.x),mix(hash(n+57.),hash(n+58.),f.x),f.y),
               mix(mix(hash(n+113.),hash(n+114.),f.x),mix(hash(n+170.),hash(n+171.),f.x),f.y),f.z);}
  vec3 curl(vec3 p){
    float e=.15;
    return vec3(
      noise(p+vec3(0,e,0))-noise(p-vec3(0,e,0))-(noise(p+vec3(0,0,e))-noise(p-vec3(0,0,e))),
      noise(p+vec3(0,0,e))-noise(p-vec3(0,0,e))-(noise(p+vec3(e,0,0))-noise(p-vec3(e,0,0))),
      noise(p+vec3(e,0,0))-noise(p-vec3(e,0,0))-(noise(p+vec3(0,e,0))-noise(p-vec3(0,e,0)))
    )/(2.*e);
  }
  void main(){
    vec3 pos=texture2D(uPositions,vUv).xyz;
    vec3 rest=texture2D(uOriginal,vUv).xyz;
    vec3 c=curl(pos*.38+vec3(uTime*.07));
    vec3 attract=(rest-pos)*.009;
    pos+=(c*uStrength+attract)*min(uDt,.033);
    if(length(pos)<.96){pos=normalize(pos)*.97;}
    gl_FragColor=vec4(pos,1.);
  }`;

/* ── GPGPU render shaders ────────────────────────── */
const renderVert = /* glsl */ `
  attribute vec2 aUv;
  uniform sampler2D uPositions;
  uniform vec3 uColorA,uColorB,uColorC;
  uniform float uTime,uOpacity;
  varying vec3 vColor; varying float vAlpha;
  void main(){
    vec3 pos=texture2D(uPositions,aUv).xyz;
    vec4 mv=modelViewMatrix*vec4(pos,1.);
    gl_Position=projectionMatrix*mv;
    float depth=-mv.z;
    gl_PointSize=clamp(320./depth,.6,5.);
    float t=fract(pos.x*.28+pos.y*.14+pos.z*.09+uTime*.035);
    vColor=t<.5?mix(uColorA,uColorB,t*2.):mix(uColorB,uColorC,(t-.5)*2.);
    vAlpha=clamp(1.5-depth*.075,.1,1.)*uOpacity;
  }`;
const renderFrag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main(){
    vec2 c=gl_PointCoord-.5;float d=length(c);
    if(d>.5)discard;
    gl_FragColor=vec4(vColor,(1.-smoothstep(.2,.5,d))*vAlpha*.9);
  }`;

/* ── Star field ──────────────────────────────────── */
export function StarField() {
  const ref = useRef<THREE.Points>(null);
  const [pos, col] = useMemo(() => {
    const cnt = 2600,
      pos = new Float32Array(cnt * 3),
      col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      const r = 18 + Math.random() ** 0.5 * 55,
        θ = Math.random() * Math.PI * 2,
        φ = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(φ) * Math.cos(θ);
      pos[i * 3 + 1] = r * Math.sin(φ) * Math.sin(θ);
      pos[i * 3 + 2] = r * Math.cos(φ);
      const b = 0.16 + Math.random() * 0.84;
      col[i * 3] = b;
      col[i * 3 + 1] = b * 0.96;
      col[i * 3 + 2] = b;
    }
    return [pos, col];
  }, []);
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.000_055;
      ref.current.rotation.x += 0.000_018;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute args={[pos, 3]} attach="attributes-position" />
        <bufferAttribute args={[col, 3]} attach="attributes-color" />
      </bufferGeometry>
      <pointsMaterial
        depthWrite={false}
        opacity={0.82}
        size={0.036}
        sizeAttenuation
        transparent
        vertexColors
      />
    </points>
  );
}

/* ── Nebula wisp dome ────────────────────────────── */
interface WispProps {
  palette: string[];
  radius?: number;
  rotY?: number;
  rotZ?: number;
}
export function NebulaWisp({
  palette,
  radius = 10,
  rotY = 0,
  rotZ = 0.3,
}: WispProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uA: { value: new THREE.Color(palette[0]) },
      uB: { value: new THREE.Color(palette[1]) },
    }),
    []
  );
  useEffect(() => {
    if (!matRef.current) return;
    u.uA.value.set(palette[0]);
    u.uB.value.set(palette[1]);
  }, [palette]);
  useFrame((_, dt) => {
    u.uTime.value += dt;
  });
  return (
    <mesh rotation={[0, rotY, rotZ]}>
      <sphereGeometry args={[radius, 36, 36]} />
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={wispFrag}
        ref={matRef}
        side={THREE.BackSide}
        transparent
        uniforms={u}
        vertexShader={wispVert}
      />
    </mesh>
  );
}

/* ── Orbital streak ──────────────────────────────── */
interface StreakProps {
  palette: string[];
  speed?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  tilt?: [number, number, number];
}
export function OrbitalStreak({
  palette,
  speed = 0.32,
  rx = 3.6,
  ry = 0.9,
  rz = 3.6,
  tilt = [0, 0, 0] as [number, number, number],
}: StreakProps) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed;
    ref.current.position.set(
      rx * Math.cos(t),
      ry * Math.sin(t * 0.68),
      rz * Math.sin(t)
    );
  });
  return (
    <group rotation={tilt}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.065, 6, 6]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={palette[2]}
          depthWrite={false}
          opacity={0.95}
          transparent
        />
      </mesh>
    </group>
  );
}

/* ── Water ripple sphere ─────────────────────────── */
interface PhaseProps {
  palette: string[];
  phase: number;
}
export function RippleSphere({ palette, phase }: PhaseProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uA: { value: new THREE.Color(palette[0]) },
      uB: { value: new THREE.Color(palette[2]) },
    }),
    []
  );
  useEffect(() => {
    if (!matRef.current) return;
    u.uA.value.set(palette[0]);
    u.uB.value.set(palette[2]);
  }, [palette]);
  const op = useRef(0);
  useFrame((_, dt) => {
    u.uTime.value += dt;
    op.current += ((phase >= 3 ? 1 : 0) - op.current) * 0.025;
    if (matRef.current) matRef.current.opacity = op.current;
  });
  return (
    <mesh>
      <sphereGeometry args={[1.52, 72, 72]} />
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={rippleFrag}
        ref={matRef}
        side={THREE.FrontSide}
        transparent
        uniforms={u}
        vertexShader={rippleVert}
      />
    </mesh>
  );
}

/* ── Inner metallic glass sphere ────────────────── */
interface InnerSphereProps {
  palette: string[];
  phase: number;
  texRef: React.MutableRefObject<THREE.Texture | null>;
}
export function InnerSphere({ palette, phase, texRef }: InnerSphereProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uA: { value: new THREE.Color(palette[0]) },
      uB: { value: new THREE.Color(palette[2]) },
      uParticles: { value: null as THREE.Texture | null },
    }),
    []
  );
  useEffect(() => {
    if (!matRef.current) return;
    u.uA.value.set(palette[0]);
    u.uB.value.set(palette[2]);
  }, [palette]);
  const op = useRef(0);
  useFrame((_, dt) => {
    u.uTime.value += dt;
    op.current += ((phase >= 3 ? 1 : 0) - op.current) * 0.028;
    u.uOpacity.value = op.current;
    if (texRef?.current) u.uParticles.value = texRef.current;
  });
  return (
    <mesh>
      <sphereGeometry args={[0.94, 80, 80]} />
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={innerFrag}
        ref={matRef}
        side={THREE.FrontSide}
        transparent
        uniforms={u}
        vertexShader={innerVert}
      />
    </mesh>
  );
}

/* ── GPGPU curl-noise particles ──────────────────── */
const GPGPU_SIZE = 192;

interface GPGPUProps {
  palette: string[];
  phase: number;
  texRef: React.MutableRefObject<THREE.Texture | null>;
}
export function CurlNoiseParticles({ palette, phase, texRef }: GPGPUProps) {
  const { gl } = useThree();
  const fboOpts = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
  };
  const fboA = useMemo(
    () => new THREE.WebGLRenderTarget(GPGPU_SIZE, GPGPU_SIZE, fboOpts),
    []
  );
  const fboB = useMemo(
    () => new THREE.WebGLRenderTarget(GPGPU_SIZE, GPGPU_SIZE, fboOpts),
    []
  );
  const simCam = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    []
  );
  const simMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPositions: { value: null },
          uOriginal: { value: null },
          uTime: { value: 0 },
          uDt: { value: 0.016 },
          uStrength: { value: 2.4 },
        },
        vertexShader: simVert,
        fragmentShader: simFrag,
        depthTest: false,
        depthWrite: false,
      }),
    []
  );
  const simMesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat);
    m.frustumCulled = false;
    return m;
  }, []);
  const originalTex = useMemo(() => {
    const data = new Float32Array(GPGPU_SIZE * GPGPU_SIZE * 4);
    for (let i = 0; i < GPGPU_SIZE * GPGPU_SIZE; i++) {
      const inner = i < GPGPU_SIZE * GPGPU_SIZE * 0.5;
      const r = inner
        ? 2 + Math.random() ** 2 * 2.8
        : 4.5 + Math.random() ** 1.2 * 4;
      const θ = Math.random() * Math.PI * 2,
        φ = Math.acos(2 * Math.random() - 1),
        flatY = inner ? 0.55 : 0.38;
      data[i * 4] = r * Math.sin(φ) * Math.cos(θ);
      data[i * 4 + 1] = r * Math.sin(φ) * Math.sin(θ) * flatY;
      data[i * 4 + 2] = r * Math.cos(φ);
      data[i * 4 + 3] = 1;
    }
    const tex = new THREE.DataTexture(
      data,
      GPGPU_SIZE,
      GPGPU_SIZE,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    tex.needsUpdate = true;
    return tex;
  }, []);
  useEffect(() => {
    simMat.uniforms.uPositions.value = originalTex;
    simMat.uniforms.uOriginal.value = originalTex;
    gl.setRenderTarget(fboA);
    gl.render(simMesh, simCam);
    gl.setRenderTarget(fboB);
    gl.render(simMesh, simCam);
    gl.setRenderTarget(null);
    return () => {
      fboA.dispose();
      fboB.dispose();
      simMat.dispose();
      originalTex.dispose();
    };
  }, []);
  const uvAttr = useMemo(() => {
    const uvs = new Float32Array(GPGPU_SIZE * GPGPU_SIZE * 2);
    for (let i = 0; i < GPGPU_SIZE; i++)
      for (let j = 0; j < GPGPU_SIZE; j++) {
        const idx = i * GPGPU_SIZE + j;
        uvs[idx * 2] = (j + 0.5) / GPGPU_SIZE;
        uvs[idx * 2 + 1] = (i + 0.5) / GPGPU_SIZE;
      }
    return uvs;
  }, []);
  const dummyPos = useMemo(
    () => new Float32Array(GPGPU_SIZE * GPGPU_SIZE * 3),
    []
  );
  const renderMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPositions: { value: originalTex },
          uColorA: { value: new THREE.Color(palette[0]) },
          uColorB: { value: new THREE.Color(palette[1]) },
          uColorC: { value: new THREE.Color(palette[2]) },
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        },
        vertexShader: renderVert,
        fragmentShader: renderFrag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );
  useEffect(() => {
    renderMat.uniforms.uColorA.value.set(palette[0]);
    renderMat.uniforms.uColorB.value.set(palette[1]);
    renderMat.uniforms.uColorC.value.set(palette[2]);
  }, [palette]);
  const pingPong = useRef({ read: fboA, write: fboB });
  const opSpring = useRef(0);
  useFrame((_, dt) => {
    const { read, write } = pingPong.current;
    const cdt = Math.min(dt, 0.033);
    const p =
      ((typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).__wgl
        : {}) as Record<string, unknown>) || {};
    // Simulation pass
    simMat.uniforms.uPositions.value = read.texture;
    simMat.uniforms.uTime.value += cdt * ((p.curlSpeed as number) ?? 1);
    simMat.uniforms.uDt.value = cdt;
    simMat.uniforms.uStrength.value = (p.curlStrength as number) ?? 2.4;
    gl.setRenderTarget(write);
    gl.render(simMesh, simCam);
    gl.setRenderTarget(null);
    renderMat.uniforms.uPositions.value = write.texture;
    renderMat.uniforms.uTime.value += cdt;
    // Expose write texture for InnerSphere proximity glow
    if (texRef) texRef.current = write.texture;
    // Phase opacity spring
    const targetOp = phase >= 5 ? 1 : 0;
    opSpring.current += (targetOp - opSpring.current) * 0.025;
    renderMat.uniforms.uOpacity.value = opSpring.current;
    pingPong.current = { read: write, write: read };
  });
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute args={[dummyPos, 3]} attach="attributes-position" />
        <bufferAttribute args={[uvAttr, 2]} attach="attributes-aUv" />
      </bufferGeometry>
      <primitive object={renderMat} />
    </points>
  );
}

/* ── Assembly orb (no scroll, no dust) ───────────── */
interface OrbProps {
  phase: number;
  palette: string[];
}
export function AssemblyOrb({ phase, palette }: OrbProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const springs = useRef({
    outerWire: 0,
    innerWire: 0,
    core: 0,
    rings: 0,
    spin: 0,
  });
  const coreU = useMemo(
    () => ({
      uTime: { value: 0 },
      uA: { value: new THREE.Color(palette[0]) },
      uB: { value: new THREE.Color(palette[1]) },
      uC: { value: new THREE.Color(palette[2]) },
      uIntensity: { value: 1 },
      uAlpha: { value: 0 },
    }),
    []
  );
  const r1 = useRef<THREE.Mesh>(null),
    r2 = useRef<THREE.Mesh>(null),
    r3 = useRef<THREE.Mesh>(null),
    r4 = useRef<THREE.Mesh>(null),
    r5 = useRef<THREE.Mesh>(null);
  const ow1 = useRef<THREE.MeshBasicMaterial>(null),
    ow2 = useRef<THREE.MeshBasicMaterial>(null),
    iw1 = useRef<THREE.MeshBasicMaterial>(null),
    iw2 = useRef<THREE.MeshBasicMaterial>(null);
  useEffect(() => {
    if (!matRef.current) return;
    coreU.uA.value.set(palette[0]);
    coreU.uB.value.set(palette[1]);
    coreU.uC.value.set(palette[2]);
  }, [palette]);
  useFrame((st, dt) => {
    const s = springs.current;
    const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
    const w =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : {};
    const ringMult =
      (w.__wgl as Record<string, unknown>)?.rings !== false ? 1 : 0;
    s.outerWire = lerp(s.outerWire, phase >= 1 ? 1 : 0, 0.045);
    s.innerWire = lerp(s.innerWire, phase >= 2 ? 1 : 0, 0.038);
    s.core = lerp(s.core, phase >= 3 ? 1 : 0, 0.035);
    s.rings = lerp(s.rings, phase >= 4 ? 1 : 0, 0.032);
    s.spin = lerp(s.spin, phase >= 3 ? 1 : 0.18, 0.02);
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * s.spin * 0.09;
      groupRef.current.rotation.x = Math.sin(st.clock.elapsedTime * 0.18) * 0.1;
    }
    if (ow1.current) ow1.current.opacity = s.outerWire * 0.22;
    if (ow2.current) ow2.current.opacity = s.outerWire * 0.1;
    if (iw1.current) iw1.current.opacity = s.innerWire * 0.35;
    if (iw2.current) iw2.current.opacity = s.innerWire * 0.18;
    coreU.uTime.value += dt;
    coreU.uAlpha.value = s.core;
    coreU.uIntensity.value = 1;
    if (r1.current) {
      (r1.current.material as THREE.MeshBasicMaterial).opacity =
        s.rings * 0.62 * ringMult;
      r1.current.rotation.z += dt * 0.085;
    }
    if (r2.current) {
      (r2.current.material as THREE.MeshBasicMaterial).opacity =
        s.rings * 0.34 * ringMult;
      r2.current.rotation.x += dt * 0.052;
    }
    if (r3.current) {
      (r3.current.material as THREE.MeshBasicMaterial).opacity =
        s.rings * 0.2 * ringMult;
      r3.current.rotation.y += dt * 0.064;
    }
    if (r4.current) {
      (r4.current.material as THREE.MeshBasicMaterial).opacity =
        s.rings * 0.13 * ringMult;
      r4.current.rotation.z -= dt * 0.038;
    }
    if (r5.current) {
      (r5.current.material as THREE.MeshBasicMaterial).opacity =
        s.rings * 0.08 * ringMult;
      r5.current.rotation.y -= dt * 0.072;
    }
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1.92, 1]} />
        <meshBasicMaterial
          color={palette[0]}
          opacity={0}
          ref={ow1}
          transparent
          wireframe
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[2.18, 2]} />
        <meshBasicMaterial
          color={palette[2]}
          opacity={0}
          ref={ow2}
          transparent
          wireframe
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.55, 3]} />
        <meshBasicMaterial
          color={palette[1]}
          opacity={0}
          ref={iw1}
          transparent
          wireframe
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.2, 12, 12]} />
        <meshBasicMaterial
          color={palette[0]}
          opacity={0}
          ref={iw2}
          transparent
          wireframe
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.48, 96, 96]} />
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={coreFrag}
          ref={matRef}
          transparent
          uniforms={coreU}
          vertexShader={coreVert}
        />
      </mesh>
      <mesh ref={r1} rotation={[Math.PI / 2.3, 0.3, 0.0]}>
        <torusGeometry args={[2.7, 0.005, 8, 260]} />
        <meshBasicMaterial color={palette[0]} opacity={0} transparent />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 2.0, -0.55, 0.38]}>
        <torusGeometry args={[3.3, 0.004, 8, 260]} />
        <meshBasicMaterial color={palette[2]} opacity={0} transparent />
      </mesh>
      <mesh ref={r3} rotation={[Math.PI / 1.75, 0.28, -0.42]}>
        <torusGeometry args={[4.2, 0.003, 8, 260]} />
        <meshBasicMaterial color={palette[1]} opacity={0} transparent />
      </mesh>
      <mesh ref={r4} rotation={[Math.PI / 3.0, 0.7, 0.22]}>
        <torusGeometry args={[5.1, 0.003, 8, 260]} />
        <meshBasicMaterial color={palette[0]} opacity={0} transparent />
      </mesh>
      <mesh ref={r5} rotation={[Math.PI / 2.8, -0.45, -0.6]}>
        <torusGeometry args={[6.4, 0.002, 8, 260]} />
        <meshBasicMaterial color={palette[2]} opacity={0} transparent />
      </mesh>
    </group>
  );
}

/* ── Mouse-tracking camera ───────────────────────── */
interface CameraTrackProps {
  mouseRef: React.MutableRefObject<[number, number]>;
}
export function CameraTrack({ mouseRef }: CameraTrackProps) {
  useFrame(({ camera }) => {
    const tx = mouseRef.current[0] * 0.46,
      ty = mouseRef.current[1] * 0.3;
    camera.position.x += (tx - camera.position.x) * 0.042;
    camera.position.y += (-ty - camera.position.y) * 0.042;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ══════════════════════════════════════════════════
   HERO NEBULA SCENE — no scroll, no DOF
   ══════════════════════════════════════════════════ */
export function NebulaScene({ phase = 5 }: { phase?: number }) {
  const palette = useContext(PaletteCtx);
  const wgl = useContext(WebGLCtx);
  const mouseRef = useRef<[number, number]>([0, 0]);
  const sunRef = useRef<THREE.Mesh | null>(null);
  const particleTexRef = useRef<THREE.Texture | null>(null);
  const [sunReady, setSunReady] = useState(false);
  useEffect(() => {
    const f = (e: PointerEvent) => {
      mouseRef.current = [
        (e.clientX / innerWidth) * 2 - 1,
        (e.clientY / innerHeight) * 2 - 1,
      ];
    };
    window.addEventListener("pointermove", f, { passive: true });
    return () => window.removeEventListener("pointermove", f);
  }, []);
  return (
    <Canvas
      aria-label="Cena 3D animada: orbe de inteligência Nebuloz com partículas de campo curl noise"
      camera={{ position: [0, 0, 7.2], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      role="img"
    >
      <fog args={["#07080c", 8, 20]} attach="fog" />
      <Suspense fallback={null}>
        <mesh
          ref={(el) => {
            sunRef.current = el;
            if (el && !sunReady) setSunReady(true);
          }}
        >
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial color={palette[0]} toneMapped={false} />
        </mesh>
        <StarField />
        <NebulaWisp palette={palette} radius={11} rotY={0} rotZ={0.3} />
        <NebulaWisp
          palette={palette}
          radius={13}
          rotY={Math.PI * 0.62}
          rotZ={-0.2}
        />
        <OrbitalStreak
          palette={palette}
          rx={3.6}
          ry={0.9}
          rz={3.6}
          speed={0.32}
          tilt={[0.3, 0, 0.2]}
        />
        <OrbitalStreak
          palette={palette}
          rx={4.8}
          ry={1.5}
          rz={4.8}
          speed={0.19}
          tilt={[-0.5, 0.3, -0.1]}
        />
        <CameraTrack mouseRef={mouseRef} />
        <AssemblyOrb palette={palette} phase={phase} />
        <InnerSphere palette={palette} phase={phase} texRef={particleTexRef} />
        <RippleSphere palette={palette} phase={phase} />
        <CurlNoiseParticles
          palette={palette}
          phase={phase}
          texRef={particleTexRef}
        />
        <EffectComposer multisampling={0}>
          <>
            {sunReady && sunRef.current && wgl?.godRays !== false && (
              <GodRays
                blendFunction={BlendFunction.SCREEN}
                blur
                clampMax={1}
                decay={0.9}
                density={0.93}
                exposure={0.48}
                kernelSize={KernelSize.SMALL}
                samples={50}
                sun={sunRef as React.MutableRefObject<THREE.Mesh>}
                weight={0.28}
              />
            )}
            <Bloom
              intensity={wgl?.bloom ?? 1.75}
              luminanceSmoothing={0.62}
              luminanceThreshold={0.03}
              mipmapBlur
              radius={0.94}
            />
            {wgl?.glitch !== false && (
              <Glitch
                delay={[6, 14] as any}
                duration={[0.06, 0.14] as any}
                mode={GlitchMode.SPORADIC}
                ratio={0.78}
                strength={[0.012, 0.032] as any}
              />
            )}
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              modulationOffset={0.11}
              offset={[0.0011, 0.0011] as any}
              radialModulation
            />
            <Vignette
              blendFunction={BlendFunction.MULTIPLY}
              darkness={0.76}
              eskil={false}
              offset={0.13}
            />
            {wgl?.fxaa && <FXAA />}
            {wgl?.noise && (
              <Noise
                blendFunction={BlendFunction.SCREEN}
                opacity={wgl.noiseOpacity ?? 0.25}
              />
            )}
            {wgl?.hueSat && (
              <HueSaturation
                hue={((wgl.hue ?? 0) * Math.PI) / 180}
                saturation={wgl.saturation ?? 0}
              />
            )}
            {wgl?.brightness && (
              <BrightnessContrast
                brightness={wgl.bright ?? 0}
                contrast={wgl.contrast ?? 0}
              />
            )}
            {wgl?.pixelate && (
              <Pixelation granularity={Math.round(wgl.pixelGranularity ?? 5)} />
            )}
            {wgl?.dof && (
              <DepthOfField
                bokehScale={wgl.dofBokeh ?? 2.8}
                focalLength={0.04}
                focusDistance={wgl.dofFocus ?? 0.02}
                height={480}
              />
            )}
          </>
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

/* ══════════════════════════════════════════════════
   CORE SCENE — MetaBrain + CTA
   ══════════════════════════════════════════════════ */
export function CoreScene() {
  const palette = useContext(PaletteCtx);
  const wgl = useContext(WebGLCtx);
  const sunRef = useRef<THREE.Mesh | null>(null);
  const particleTexRef = useRef<THREE.Texture | null>(null);
  const [sunReady, setSunReady] = useState(false);
  return (
    <Canvas
      aria-label="Cena 3D animada: MetaBrain — grafo de conhecimento organizacional"
      camera={{ position: [0, 0, 5.2], fov: 40 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      role="img"
    >
      <Suspense fallback={null}>
        <mesh
          ref={(el) => {
            sunRef.current = el;
            if (el && !sunReady) setSunReady(true);
          }}
        >
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshBasicMaterial color={palette[0]} toneMapped={false} />
        </mesh>
        <StarField />
        <NebulaWisp palette={palette} radius={9} rotY={1.1} rotZ={0.4} />
        <OrbitalStreak
          palette={palette}
          rx={3}
          ry={0.7}
          rz={3}
          speed={0.26}
          tilt={[0.2, 0, 0.1]}
        />
        <AssemblyOrb palette={palette} phase={5} />
        <InnerSphere palette={palette} phase={5} texRef={particleTexRef} />
        <RippleSphere palette={palette} phase={5} />
        <CurlNoiseParticles
          palette={palette}
          phase={5}
          texRef={particleTexRef}
        />
        <EffectComposer multisampling={0}>
          <>
            {sunReady && sunRef.current && wgl?.godRays !== false && (
              <GodRays
                blendFunction={BlendFunction.SCREEN}
                blur
                clampMax={1}
                decay={0.88}
                density={0.91}
                exposure={0.42}
                kernelSize={KernelSize.SMALL}
                samples={40}
                sun={sunRef as React.MutableRefObject<THREE.Mesh>}
                weight={0.24}
              />
            )}
            <Bloom
              intensity={wgl?.bloom ?? 1.9}
              luminanceSmoothing={0.55}
              luminanceThreshold={0.03}
              mipmapBlur
              radius={0.96}
            />
            {wgl?.glitch !== false && (
              <Glitch
                delay={[8, 18] as any}
                duration={[0.05, 0.12] as any}
                mode={GlitchMode.SPORADIC}
                ratio={0.82}
                strength={[0.008, 0.025] as any}
              />
            )}
            <Scanline blendFunction={BlendFunction.OVERLAY} density={1.05} />
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              modulationOffset={0.17}
              offset={[0.0009, 0.0009] as any}
              radialModulation
            />
            <Vignette
              blendFunction={BlendFunction.MULTIPLY}
              darkness={0.84}
              eskil={false}
              offset={0.2}
            />
            {wgl?.fxaa && <FXAA />}
            {wgl?.noise && (
              <Noise
                blendFunction={BlendFunction.SCREEN}
                opacity={wgl.noiseOpacity ?? 0.25}
              />
            )}
            {wgl?.hueSat && (
              <HueSaturation
                hue={((wgl.hue ?? 0) * Math.PI) / 180}
                saturation={wgl.saturation ?? 0}
              />
            )}
            {wgl?.brightness && (
              <BrightnessContrast
                brightness={wgl.bright ?? 0}
                contrast={wgl.contrast ?? 0}
              />
            )}
            {wgl?.pixelate && (
              <Pixelation granularity={Math.round(wgl.pixelGranularity ?? 5)} />
            )}
          </>
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
