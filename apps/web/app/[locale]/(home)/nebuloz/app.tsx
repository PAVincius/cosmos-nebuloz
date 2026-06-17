"use client";

import { useEffect, useState } from "react";
import { Footer } from "./chrome";
import { PaletteCtx, WebGLCtx } from "./contexts";
import { SystemDiagram } from "./diagram";
import { CursorGlow, Hero } from "./hero";
import {
  Convictions,
  CTA,
  MetaBrain,
  Modules,
  Numbers,
  PlatformArch,
  Workspace,
} from "./sections";
import { TweaksPanel, useTweaks } from "./tweaks";

export function NebulozApp() {
  const tw = useTweaks();
  const [, force] = useState(0);

  // Force one extra render shortly after mount to kick off framer-motion animations
  // (with our custom loader, first-render layout effects can be skipped when the
  // tab is initially hidden).
  useEffect(() => {
    const ticks = [50, 250, 800].map((d) =>
      setTimeout(() => force((v) => v + 1), d)
    );
    const onVis = () => {
      if (!document.hidden) force((v) => v + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ticks.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // accent CSS vars switching — affects ALL CSS gradients that use var(--c-*)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--c-violet", tw.palette[0]);
    root.style.setProperty("--c-indigo", tw.palette[1]);
    root.style.setProperty("--c-cyan", tw.palette[2]);
    // also update inline dot colors used by elements that use hex
    root.style.setProperty("--dot-violet-color", tw.palette[0]);
    root.style.setProperty("--dot-cyan-color", tw.palette[2]);
  }, [tw.palette]);

  return (
    <WebGLCtx.Provider value={tw.wgl}>
      <PaletteCtx.Provider value={tw.palette}>
        <div className="relative" data-screen-label="Nebuloz Home">
          <CursorGlow palette={tw.palette} />
          <Hero />
          <main id="main-content">
            <PlatformArch />
            <Convictions />
            <Workspace />
            <SystemDiagram />
            <MetaBrain />
            <Modules />
            <Numbers />
            <CTA />
          </main>
          <Footer />
          <TweaksPanel tw={tw} />
        </div>
      </PaletteCtx.Provider>
    </WebGLCtx.Provider>
  );
}
