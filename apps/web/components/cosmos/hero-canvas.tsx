"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, PerformanceMonitor } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from "@react-three/postprocessing";
import { Vector2 } from "three";
import { useRef, useMemo, useState } from "react";
import type { Points, Mesh } from "three";

const CHROMA_OFFSET = new Vector2(0.0003, 0.0003);

function ParticleField() {
  const ref = useRef<Points>(null!);

  const positions = useMemo(() => {
    const count = 420;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 26;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 15;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return arr;
  }, []);

  useFrame(({ clock, pointer }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.y = Math.sin(t * 0.11) * 0.09;
    ref.current.rotation.x = Math.sin(t * 0.07) * 0.05;
    ref.current.position.x += (pointer.x * 0.9 - ref.current.position.x) * 0.04;
    ref.current.position.y += (pointer.y * 0.55 - ref.current.position.y) * 0.04;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#00D4FF"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function DistortedOrb() {
  const ref = useRef<Mesh>(null!);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = clock.elapsedTime * 0.06;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.22} floatIntensity={0.5} floatingRange={[-0.3, 0.3]}>
      <mesh ref={ref} position={[2.5, 0.2, -2]}>
        <sphereGeometry args={[1.8, 64, 64]} />
        <MeshDistortMaterial
          distort={0.4}
          speed={1.6}
          color="#00D4FF"
          emissive="#00D4FF"
          emissiveIntensity={0.55}
          roughness={0.1}
          metalness={0.05}
          transparent
          opacity={0.11}
          depthWrite={false}
        />
      </mesh>
    </Float>
  );
}

function SecondaryOrb() {
  return (
    <Float speed={0.8} rotationIntensity={0.12} floatIntensity={0.25} floatingRange={[-0.15, 0.15]}>
      <mesh position={[-4, 1.8, -4]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <MeshDistortMaterial
          distort={0.55}
          speed={2.0}
          color="#7c6cff"
          emissive="#7c6cff"
          emissiveIntensity={0.5}
          transparent
          opacity={0.07}
          depthWrite={false}
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
        luminanceThreshold={0.05}
        luminanceSmoothing={0.85}
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
          onIncline={() => setDpr(1.5)}
          onDecline={() => setDpr(1)}
        />
        <ParticleField />
        <DistortedOrb />
        <SecondaryOrb />
        <Effects />
      </Canvas>
    </div>
  );
}
