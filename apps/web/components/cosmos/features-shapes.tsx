"use client";
import { Float, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useRef, useState } from "react";
import type { Mesh } from "three";

type ShapeProps = {
  position: [number, number, number];
  color: string;
  speed: number;
  rotIntensity: number;
};

function WireIcosahedron({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }
    ref.current.rotation.x = clock.elapsedTime * 0.22 * speed;
    ref.current.rotation.y = clock.elapsedTime * 0.18 * speed;
  });
  return (
    <Float
      autoInvalidate
      floatIntensity={0.4}
      floatingRange={[-0.15, 0.15]}
      rotationIntensity={rotIntensity}
      speed={speed * 0.6}
    >
      <mesh position={position} ref={ref}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          opacity={0.7}
          transparent
          wireframe
        />
      </mesh>
    </Float>
  );
}

function WireTorus({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }
    ref.current.rotation.x = clock.elapsedTime * 0.28 * speed;
    ref.current.rotation.z = clock.elapsedTime * 0.14 * speed;
  });
  return (
    <Float
      autoInvalidate
      floatIntensity={0.35}
      floatingRange={[-0.1, 0.1]}
      rotationIntensity={rotIntensity}
      speed={speed * 0.5}
    >
      <mesh position={position} ref={ref}>
        <torusGeometry args={[0.45, 0.16, 10, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          opacity={0.65}
          transparent
          wireframe
        />
      </mesh>
    </Float>
  );
}

function WireOctahedron({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }
    ref.current.rotation.y = clock.elapsedTime * 0.32 * speed;
    ref.current.rotation.x = clock.elapsedTime * 0.12 * speed;
  });
  return (
    <Float
      autoInvalidate
      floatIntensity={0.45}
      floatingRange={[-0.2, 0.2]}
      rotationIntensity={rotIntensity}
      speed={speed * 0.7}
    >
      <mesh position={position} ref={ref}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.65}
          opacity={0.6}
          transparent
          wireframe
        />
      </mesh>
    </Float>
  );
}

function WireTetrahedron({ position, color, speed, rotIntensity }: ShapeProps) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }
    ref.current.rotation.x = clock.elapsedTime * 0.2 * speed;
    ref.current.rotation.z = clock.elapsedTime * 0.25 * speed;
  });
  return (
    <Float
      autoInvalidate
      floatIntensity={0.38}
      floatingRange={[-0.12, 0.12]}
      rotationIntensity={rotIntensity}
      speed={speed * 0.55}
    >
      <mesh position={position} ref={ref}>
        <tetrahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          opacity={0.6}
          transparent
          wireframe
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
        <PerformanceMonitor
          onDecline={() => setDpr(0.8)}
          onIncline={() => setDpr(1.2)}
        />
        <ambientLight intensity={0.3} />
        <pointLight color="#00D4FF" intensity={1.5} position={[0, 0, 4]} />

        {/* Top-left — Dependency card (cyan icosahedron) */}
        <WireIcosahedron
          color="#00D4FF"
          position={[-3.6, 1.8, -1.5]}
          rotIntensity={0.6}
          speed={1.2}
        />

        {/* Top-right — Portfolio card (green torus) */}
        <WireTorus
          color="#29cc7a"
          position={[3.8, 1.6, -1.2]}
          rotIntensity={0.5}
          speed={0.9}
        />

        {/* Bottom-left — AI On-Premise (violet octahedron) */}
        <WireOctahedron
          color="#7c6cff"
          position={[-3.5, -1.9, -1.0]}
          rotIntensity={0.7}
          speed={1.1}
        />

        {/* Bottom-right — Metrics (amber tetrahedron) */}
        <WireTetrahedron
          color="#f5b942"
          position={[3.6, -1.7, -1.3]}
          rotIntensity={0.55}
          speed={1.0}
        />

        <EffectComposer>
          <Bloom
            intensity={1.8}
            luminanceSmoothing={0.88}
            luminanceThreshold={0.04}
            mipmapBlur
            radius={0.55}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
