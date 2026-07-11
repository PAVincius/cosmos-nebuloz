"use client";

import { useEffect, useRef } from "react";

type Vec3 = { x: number; y: number; z: number };
type Particle = { x: number; y: number; z: number; char: string; kind: "shell" | "ring" };

const VIOLET = [124, 108, 255] as const;
const CYAN = [60, 195, 255] as const;
const SHELL_CHARS = "·•◦+*";

const rotY = (p: Vec3, a: number): Vec3 => ({
  x: p.x * Math.cos(a) - p.z * Math.sin(a),
  y: p.y,
  z: p.x * Math.sin(a) + p.z * Math.cos(a),
});

const rotX = (p: Vec3, a: number): Vec3 => ({
  x: p.x,
  y: p.y * Math.cos(a) - p.z * Math.sin(a),
  z: p.y * Math.sin(a) + p.z * Math.cos(a),
});

const mix = (t: number): [number, number, number] => [
  Math.round(VIOLET[0] + (CYAN[0] - VIOLET[0]) * t),
  Math.round(VIOLET[1] + (CYAN[1] - VIOLET[1]) * t),
  Math.round(VIOLET[2] + (CYAN[2] - VIOLET[2]) * t),
];

export function AnimatedDysonSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const R = Math.min(rect.width, rect.height) * 0.42;

      // Star core glow (the encased sun)
      const coreR = R * 0.55;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      glow.addColorStop(0, "rgba(190,180,255,0.85)");
      glow.addColorStop(0.4, "rgba(124,108,255,0.32)");
      glow.addColorStop(1, "rgba(124,108,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const pts: Particle[] = [];

      // Shell lattice (the Dyson sphere surface)
      for (let phi = 0; phi < Math.PI * 2; phi += 0.22) {
        for (let theta = 0.12; theta < Math.PI; theta += 0.22) {
          let p: Vec3 = {
            x: Math.sin(theta) * Math.cos(phi),
            y: Math.cos(theta),
            z: Math.sin(theta) * Math.sin(phi),
          };
          p = rotX(rotY(p, time * 0.25), 0.5);
          pts.push({
            x: cx + p.x * R,
            y: cy - p.y * R,
            z: p.z,
            char: SHELL_CHARS[Math.floor(((p.z + 1) / 2) * (SHELL_CHARS.length - 1))],
            kind: "shell",
          });
        }
      }

      // Orbital swarm rings
      const rings = [
        { tilt: 0.5, rad: 1.12, yaw: time * 0.4 },
        { tilt: 1.2, rad: 1.28, yaw: -time * 0.3 + 1 },
      ];
      for (const ring of rings) {
        for (let a = 0; a < Math.PI * 2; a += 0.08) {
          let p: Vec3 = { x: Math.cos(a) * ring.rad, y: 0, z: Math.sin(a) * ring.rad };
          p = rotY(rotX(p, ring.tilt), ring.yaw);
          pts.push({ x: cx + p.x * R, y: cy - p.y * R, z: p.z, char: "•", kind: "ring" });
        }
      }

      pts.sort((a, b) => a.z - b.z);
      for (const p of pts) {
        const front = (p.z + 1) / 2;
        const [r, g, b] = mix(p.kind === "ring" ? 0.7 : front);
        const alpha = p.kind === "ring" ? 0.25 + front * 0.6 : 0.12 + front * 0.5;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillText(p.char, p.x, p.y);
      }

      time += 0.015;
      frameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />;
}
