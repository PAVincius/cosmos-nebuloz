"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useRef, useState } from "react";
import type { Mesh } from "three";

interface ShapeProps {
  position: [number, number, number];
  color: string;
  speed: number;
  rotIntensity: number;
}

function WireIcosahedron({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.elapsedTime * 0.22 * speed;
    ref.current.rotation.y = clock.elapsedTime * 0.18 * speed;
  });
  return (
    <Float speed={speed * 0.6} rotationIntensity={rotIntensity} floatIntensity={0.4} floatingRange={[-0.15, 0.15]} autoInvalidate>
      <mesh ref={ref} position={position}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  );
}

function WireTorus({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.elapsedTime * 0.28 * speed;
    ref.current.rotation.z = clock.elapsedTime * 0.14 * speed;
  });
  return (
    <Float speed={speed * 0.5} rotationIntensity={rotIntensity} floatIntensity={0.35} floatingRange={[-0.1, 0.1]} autoInvalidate>
      <mesh ref={ref} position={position}>
        <torusGeometry args={[0.45, 0.16, 10, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          wireframe
          transparent
          opacity={0.65}
        />
      </mesh>
    </Float>
  );
}

function WireOctahedron({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.32 * speed;
    ref.current.rotation.x = clock.elapsedTime * 0.12 * speed;
  });
  return (
    <Float speed={speed * 0.7} rotationIntensity={rotIntensity} floatIntensity={0.45} floatingRange={[-0.2, 0.2]} autoInvalidate>
      <mesh ref={ref} position={position}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.65}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>
    </Float>
  );
}

function WireTetrahedron({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.elapsedTime * 0.2 * speed;
    ref.current.rotation.z = clock.elapsedTime * 0.25 * speed;
  });
  return (
    <Float speed={speed * 0.55} rotationIntensity={rotIntensity} floatIntensity={0.38} floatingRange={[-0.12, 0.12]} autoInvalidate>
      <mesh ref={ref} position={position}>
        <tetrahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>
    </Float>
  );
}

export function FeaturesShapes() {
  const [dpr, setDpr] = useState(1.2);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 1, mixBlendMode: "screen" }}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={dpr}
        frameloop="demand"
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <PerformanceMonitor onIncline={() => setDpr(1.2)} onDecline={() => setDpr(0.8)} />
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 0, 4]} intensity={1.5} color="#00D4FF" />

        {/* Top-left — Dependency card (cyan icosahedron) */}
        <WireIcosahedron position={[-3.6, 1.8, -1.5]} color="#00D4FF" speed={1.2} rotIntensity={0.6} />

        {/* Top-right — Portfolio card (green torus) */}
        <WireTorus position={[3.8, 1.6, -1.2]} color="#29cc7a" speed={0.9} rotIntensity={0.5} />

        {/* Bottom-left — AI On-Premise (violet octahedron) */}
        <WireOctahedron position={[-3.5, -1.9, -1.0]} color="#7c6cff" speed={1.1} rotIntensity={0.7} />

        {/* Bottom-right — Metrics (amber tetrahedron) */}
        <WireTetrahedron position={[3.6, -1.7, -1.3]} color="#f5b942" speed={1.0} rotIntensity={0.55} />

        <EffectComposer>
          <Bloom
            intensity={1.8}
            luminanceThreshold={0.04}
            luminanceSmoothing={0.88}
            mipmapBlur
            radius={0.55}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
