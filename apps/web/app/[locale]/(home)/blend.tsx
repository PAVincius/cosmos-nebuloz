"use client";

import { useEffect, useState } from "react";
import { PaletteCtx, WebGLCtx } from "./nebuloz/contexts";
import { SystemDiagram } from "./nebuloz/diagram";
import { CursorGlow, Hero } from "./nebuloz/hero";
import {
  Convictions,
  MetaBrain,
  Modules,
  Numbers,
  PlatformArch,
  Workspace,
} from "./nebuloz/sections";
import { BackgroundBeams } from "./nebuloz/background-beams";
import { tierWgl, useSceneTier } from "./nebuloz/scene-mount";
import { useTweaks } from "./nebuloz/tweaks";

// v0 (Optimus rebrand) marketing funnel — appended after the premium experience
import { FeaturesSection } from "@/_v0preview/components/landing/features-section";
import { HowItWorksSection } from "@/_v0preview/components/landing/how-it-works-section";
import { IntegrationsSection } from "@/_v0preview/components/landing/integrations-section";
import { SecuritySection } from "@/_v0preview/components/landing/security-section";
import { MetricsSection } from "@/_v0preview/components/landing/metrics-section";
import { DevelopersSection } from "@/_v0preview/components/landing/developers-section";
import { TestimonialsSection } from "@/_v0preview/components/landing/testimonials-section";
import { PricingSection } from "@/_v0preview/components/landing/pricing-section";
import { CtaSection } from "@/_v0preview/components/landing/cta-section";
import { FooterSection } from "@/_v0preview/components/landing/footer-section";

// ponytail: blend proposal — real 3D hero + premium sections, then the v0 funnel.
// Throwaway comparison route; collapse into nebuloz/ once a direction is chosen.
export function BlendApp() {
  const tw = useTweaks();
  const tier = useSceneTier();
  const [, force] = useState(0);

  useEffect(() => {
    const ticks = [50, 250, 800].map((d) => setTimeout(() => force((v) => v + 1), d));
    const onVis = () => {
      if (!document.hidden) force((v) => v + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ticks.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--c-violet", tw.palette[0]);
    root.style.setProperty("--c-indigo", tw.palette[1]);
    root.style.setProperty("--c-cyan", tw.palette[2]);
    root.style.setProperty("--dot-violet-color", tw.palette[0]);
    root.style.setProperty("--dot-cyan-color", tw.palette[2]);
  }, [tw.palette]);

  return (
    <WebGLCtx.Provider
      value={tierWgl(
        { ...tw.wgl, fxaa: true, noise: true, noiseOpacity: 0.08 },
        tier
      )}
    >
      <PaletteCtx.Provider value={tw.palette}>
        <div className="relative" data-screen-label="Nebuloz Blend">
          <BackgroundBeams />
          <CursorGlow palette={tw.palette} />
          <Hero variant="blend" />
          <main className="relative" id="main-content">
            {/* Premium experience (current real site) */}
            <PlatformArch />
            <Convictions />
            <Workspace />
            <SystemDiagram />
            <MetaBrain />
            <Modules />
            <Numbers />

            {/* Conversion funnel (v0 / Optimus rebrand) — shadcn dark tokens */}
            <div className="dark bg-background text-foreground">
              <FeaturesSection />
              <HowItWorksSection />
              <IntegrationsSection />
              <SecuritySection />
              <MetricsSection />
              <DevelopersSection />
              <TestimonialsSection />
              <PricingSection />
              <CtaSection />
              <FooterSection />
            </div>
          </main>
        </div>
      </PaletteCtx.Provider>
    </WebGLCtx.Provider>
  );
}
