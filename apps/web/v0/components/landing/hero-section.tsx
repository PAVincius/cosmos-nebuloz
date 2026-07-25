"use client";

import { useEffect, useState } from "react";
import { AnimatedDysonSphere } from "./animated-dyson-sphere";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Nebuloz bg-grid */}
      <div className="absolute inset-0 bg-nz-grid opacity-100 pointer-events-none" style={{ maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }} />

      {/* Animated Dyson sphere background */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-70 pointer-events-none">
        <AnimatedDysonSphere />
      </div>
      
      {/* Violet ambient glow */}
      <div className="absolute left-1/4 top-1/3 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(124,108,255,0.12) 0%, transparent 70%)" }} />
      <div className="absolute right-1/4 bottom-1/3 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(60,195,255,0.08) 0%, transparent 70%)" }} />
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-32 lg:py-40">
        {/* Eyebrow — Nebuloz style: status dot + mono label */}
        <div 
          className={`mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border nz-label text-muted-foreground" style={{ borderColor: 'var(--c-hairline)', background: 'rgba(255,255,255,0.025)' }}>
            <span className="dot dot-violet" aria-hidden="true" />
            Camada de inteligência operacional
          </span>
        </div>
        
        {/* Main headline */}
        <div className="mb-12">
          <h1 
            className={`text-[clamp(3rem,12vw,10rem)] font-display leading-[0.9] tracking-tighter transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ letterSpacing: "-0.04em" }}
          >
            <span className="block grad-text">Clareza a partir</span>
            <span className="block accent-text">da complexidade.</span>
          </h1>
        </div>
        
        {/* Description */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end">
          <p 
            className={`text-xl lg:text-2xl leading-relaxed max-w-xl transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ color: "var(--nz-body)" }}
          >
            A plataforma de inteligência operacional que conecta seus sistemas,
            eventos e agentes de IA para entregar clareza e governança em tempo real.
          </p>
          
          {/* CTAs */}
          <div 
            className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <a href="#join" className="btn-primary group">
              <span>Começar agora</span>
              <svg width="14" height="14" viewBox="0 0 14 14" className="opacity-70 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a href="#platform" className="btn-ghost">
              <span>Ver demo</span>
            </a>
          </div>

          {/* Trust badges — handoff pattern */}
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-8 transition-all duration-700 delay-500 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <span className="label inline-flex items-center gap-1.5" style={{ color: 'var(--nz-muted)' }}>
              <span className="dot dot-success" aria-hidden="true" />SOC 2 II
            </span>
            <span className="w-px h-2.5 bg-white/10" />
            <span className="label inline-flex items-center gap-1.5" style={{ color: 'var(--nz-muted)' }}>
              <span className="dot dot-violet" aria-hidden="true" />Self-hosted
            </span>
            <span className="w-px h-2.5 bg-white/10" />
            <span className="label inline-flex items-center gap-1.5" style={{ color: 'var(--nz-muted)' }}>
              <span className="dot dot-cyan" aria-hidden="true" />BYOK
            </span>
            <span className="w-px h-2.5 bg-white/10" />
            <span className="label" style={{ color: 'var(--nz-muted)' }}>99.99% uptime</span>
          </div>
        </div>
        
      </div>
      
      {/* Trust badges */}
      <div
        className={`transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      />{/* spacer — badges are inline below CTAs */}
      
      {/* Scroll indicator */}
      
    </section>
  );
}
