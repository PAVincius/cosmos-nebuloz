"use client";
import {
  Float,
  MeshDistortMaterial,
  PerformanceMonitor,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import type { Mesh, Points } from "three";
import { Vector2 } from "three";

const CHROMA_OFFSET = new Vector2(0.0003, 0.0003);

function ParticleField() {
  const ref = useRef<Points>(null!);

  const positions = useMemo(() => {
    const count = 420;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 26;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 15;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return arr;
  }, []);

  useFrame(({ clock, pointer }) => {
    if (!ref.current) {
      return;
    }
    const t = clock.elapsedTime;
    ref.current.rotation.y = Math.sin(t * 0.11) * 0.09;
    ref.current.rotation.x = Math.sin(t * 0.07) * 0.05;
    ref.current.position.x += (pointer.x * 0.9 - ref.current.position.x) * 0.04;
    ref.current.position.y +=
      (pointer.y * 0.55 - ref.current.position.y) * 0.04;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
      </bufferGeometry>
      <pointsMaterial
        color="#00D4FF"
        depthWrite={false}
        opacity={0.55}
        size={0.045}
        sizeAttenuation
        transparent
      />
    </points>
  );
}

function DistortedOrb() {
  const ref = useRef<Mesh>(null!);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }
    ref.current.rotation.z = clock.elapsedTime * 0.06;
  });

  return (
    <Float
      floatIntensity={0.5}
      floatingRange={[-0.3, 0.3]}
      rotationIntensity={0.22}
      speed={1.4}
    >
      <mesh position={[2.5, 0.2, -2]} ref={ref}>
        <sphereGeometry args={[1.8, 64, 64]} />
        <MeshDistortMaterial
          color="#00D4FF"
          depthWrite={false}
          distort={0.4}
          emissive="#00D4FF"
          emissiveIntensity={0.55}
          metalness={0.05}
          opacity={0.11}
          roughness={0.1}
          speed={1.6}
          transparent
        />
      </mesh>
    </Float>
  );
}

function SecondaryOrb() {
  return (
    <Float
      floatIntensity={0.25}
      floatingRange={[-0.15, 0.15]}
      rotationIntensity={0.12}
      speed={0.8}
    >
      <mesh position={[-4, 1.8, -4]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <MeshDistortMaterial
          color="#7c6cff"
          depthWrite={false}
          distort={0.55}
          emissive="#7c6cff"
          emissiveIntensity={0.5}
          opacity={0.07}
          speed={2.0}
          transparent
        />
      </mesh>
    </Float>
  );
}

function Effects() {
  return (
    <EffectComposer>
      <Bloom
        intensity={2.2}
        luminanceSmoothing={0.85}
        luminanceThreshold={0.05}
        mipmapBlur
        radius={0.85}
      />
      <ChromaticAberration offset={CHROMA_OFFSET} />
      <Vignette darkness={0.45} offset={0.4} />
    </EffectComposer>
  );
}

export function HeroCanvas() {
  const [dpr, setDpr] = useState(1.5);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 0, mixBlendMode: "screen" }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        dpr={dpr}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
        }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(1.5)}
        />
        <ParticleField />
        <DistortedOrb />
        <SecondaryOrb />
        <Effects />
      </Canvas>
    </div>
  );
}
