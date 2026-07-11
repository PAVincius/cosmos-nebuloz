"use client";

import { useInView } from "framer-motion";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { WGLConfig } from "./contexts";

// ponytail: capability gate computed once. Skips heavy WebGL on reduced-motion,
// small touch devices, and low-core/low-memory machines — where postprocessing
// (bloom/godrays/DoF) tanks frame rate. Upgrade path: tier the effects instead
// of all-or-nothing if mid devices want a lighter scene.
function detectCapable(): boolean {
  if (typeof window === "undefined") return false;
  const mm = (q: string) => window.matchMedia(q).matches;
  if (mm("(prefers-reduced-motion: reduce)")) return false;
  if (mm("(pointer: coarse)") && mm("(max-width: 820px)")) return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  return cores >= 4 && mem >= 4;
}

/** True only when the element is near the viewport, the device is capable,
 *  and the tab is visible. Drives mount/unmount of WebGL scenes. */
export function useSceneActive<T extends Element>(
  ref: RefObject<T>,
  margin = "400px"
): boolean {
  // framer-motion's margin type is a branded string; "400px" is valid at runtime.
  const inView = useInView(ref, { margin: margin as `${number}px` });
  const [capable, setCapable] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setCapable(detectCapable());
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return inView && capable && visible;
}

/** Render tier among capable devices: "high" runs all postprocessing,
 *  "mid" keeps bloom only (drops godrays/glitch/DoF). */
export function useSceneTier(): "high" | "mid" {
  const [tier, setTier] = useState<"high" | "mid">("mid");
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    setTier(cores >= 8 && mem >= 8 ? "high" : "mid");
  }, []);
  return tier;
}

/** Strip expensive effects for the mid tier. */
export function tierWgl(wgl: WGLConfig, tier: "high" | "mid"): WGLConfig {
  if (tier === "high") return wgl;
  return {
    ...wgl,
    godRays: false,
    glitch: false,
    dof: false,
    bloom: Math.min(wgl.bloom ?? 1.75, 1.2),
  };
}

/** Cheap on-brand glow used wherever a WebGL scene is skipped. */
export function OrbFallback({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none h-full w-full ${className}`}
      style={{
        background:
          "radial-gradient(circle at 60% 50%, var(--c-violet), transparent 45%), radial-gradient(circle at 66% 56%, var(--c-cyan), transparent 34%)",
        opacity: 0.16,
        filter: "blur(24px)",
      }}
    />
  );
}

/** Wraps a WebGL scene so it only mounts when active; renders a fallback otherwise. */
export function SceneMount({
  children,
  fallback,
  className,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useSceneActive(ref);
  return (
    <div className={className} ref={ref}>
      {active ? children : fallback}
    </div>
  );
}
