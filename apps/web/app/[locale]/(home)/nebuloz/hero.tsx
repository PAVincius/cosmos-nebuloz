"use client";

import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Nav } from "./chrome";
import { ProofStrip } from "./sections";

const NebulaScene = dynamic(
  () => import("./scene").then((m) => ({ default: m.NebulaScene })),
  { ssr: false }
);

/* ===== Cursor glow — spring-tracked radial light ===== */
export function CursorGlow({ palette }: { palette: string[] }) {
  const x = useMotionValue(-600);
  const y = useMotionValue(-600);
  const sx = useSpring(x, { stiffness: 65, damping: 18 });
  const sy = useSpring(y, { stiffness: 65, damping: 18 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX - 300);
      y.set(e.clientY - 300);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed z-[3] mix-blend-screen"
      style={{ x: sx, y: sy, top: 0, left: 0, width: 600, height: 600 }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `radial-gradient(circle, ${palette[0]}2e 0%, ${palette[1]}12 42%, transparent 68%)`,
        }}
      />
    </motion.div>
  );
}

/* Assembly progress indicator — 5 small dots that light up as sphere builds */
export function AssemblyIndicator({ phase }: { phase: number }) {
  const labels = ["outer", "grid", "core", "rings", "dust"];
  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-hidden="true"
      className="mt-8 flex items-center gap-2"
      initial={{ opacity: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
    >
      <span className="mono mr-1 text-[11px] text-muted uppercase tracking-wider">
        Build
      </span>
      {labels.map((l, i) => (
        <div className="flex items-center gap-1.5" key={l}>
          <div
            className="h-1.5 w-1.5 rounded-full transition-all duration-500"
            style={{
              background:
                phase > i ? "var(--c-violet)" : "rgba(255,255,255,0.12)",
              boxShadow: phase > i ? "0 0 6px var(--c-violet)" : "none",
            }}
          />
          {i < labels.length - 1 && (
            <div
              className="h-px w-4 transition-all duration-700"
              style={{
                background:
                  phase > i + 1 ? "var(--c-violet)" : "rgba(255,255,255,0.08)",
              }}
            />
          )}
        </div>
      ))}
      <span className="mono ml-1 text-[11px] text-muted capitalize">
        {phase > 0 ? labels[Math.min(phase - 1, 4)] : "—"}
      </span>
    </motion.div>
  );
}

export function SplitHeading({
  text,
  delay = 0,
  accent = false,
}: {
  text: string;
  delay?: number;
  accent?: boolean;
}) {
  const words = text.split(" ");
  return (
    <span className="block">
      {words.map((w, i) => (
        <span className="inline-block overflow-hidden align-bottom" key={i}>
          <motion.span
            animate={{ y: 0 }}
            className={`inline-block ${accent ? "accent-text" : "grad-text"}`}
            initial={{ y: "100%" }}
            transition={{
              duration: 0.9,
              ease: [0.16, 1, 0.3, 1],
              delay: delay + i * 0.06,
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function Crosshairs() {
  const corners = [
    "top-5 left-5",
    "top-5 right-5",
    "bottom-5 left-5",
    "bottom-5 right-5",
  ];
  return (
    <div className="pointer-events-none">
      {corners.map((c, i) => (
        <div className={`absolute ${c} hidden opacity-50 lg:block`} key={i}>
          <svg
            className="text-white/25"
            height="18"
            viewBox="0 0 22 22"
            width="18"
          >
            <path
              d="M0 11h22M11 0v22"
              stroke="currentColor"
              strokeWidth="0.7"
            />
          </svg>
        </div>
      ))}
      {/* Coordinates only on very wide screens, away from text panel */}
      <div className="-translate-y-1/2 mono absolute top-1/2 right-5 hidden flex-col items-center gap-1 text-[9px] text-white/25 xl:flex">
        <span className="-rotate-90 origin-center tracking-[0.3em]">
          W · 122.3322
        </span>
      </div>
    </div>
  );
}

/* Mini workspace shell — the "product proof" visible in the hero.
   Shows a specific use case: incident radar / policy violation. */
export function HeroShell() {
  return (
    <div className="ws-shell p-2.5 md:p-4">
      <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0a0d16]">
        {/* chrome bar */}
        <div className="flex h-9 items-center gap-3 border-white/5 border-b bg-white/[0.015] px-4">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="mono ml-3 flex items-center gap-2 text-[10px] text-muted">
            <span>nebuloz</span>
            <span className="text-white/20">/</span>
            <span className="text-body">incident-radar</span>
          </div>
          <div className="mono ml-auto flex items-center gap-3 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="dot dot-success" /> healthy
            </span>
            <span>p95 · 184ms</span>
          </div>
        </div>

        <div className="grid min-h-[280px] grid-cols-12 md:min-h-[340px]">
          {/* Sidebar — design receipt: real nav structure */}
          <div className="col-span-2 hidden border-white/5 border-r p-3 md:block">
            <div className="label mb-2 px-2 text-[9px] text-muted">MODULES</div>
            {[
              "Incident Radar",
              "Policy Engine",
              "Connectors",
              "Telemetry",
              "Team",
            ].map((l, i) => (
              <div
                className={`mb-0.5 rounded-md px-2 py-1.5 text-[11px] ${i === 0 ? "bg-white/[0.05] text-ink" : "text-muted"}`}
                key={l}
              >
                {l}
              </div>
            ))}
          </div>

          {/* Main — the "product proof" moment */}
          <div className="col-span-12 border-white/5 border-r p-4 md:col-span-7 md:p-5">
            <div className="mono mb-1 text-[10px] text-muted">
              RUN · #2048 · access-audit-q3
            </div>
            <div className="display mb-4 text-[18px] md:text-[22px]">
              8 grants flagged · 3 require rotation
            </div>

            {/* Design receipt: real policy snippet */}
            <div className="ws-panel mb-3 p-3 font-mono text-[11px] leading-relaxed">
              <div className="mb-1 text-muted">
                // policy.nz — residency enforcement
              </div>
              <div>
                <span className="text-violet">rule</span>{" "}
                <span className="text-ink">access_residency</span> {"{"}
              </div>
              <div className="pl-4">
                <span className="text-muted">when</span> grant.region{" "}
                <span className="text-cyan">∉</span> workspace.allowed_regions
              </div>
              <div className="pl-4">
                <span className="text-muted">then</span>{" "}
                <span className="text-danger">flag</span> +
                notify(workspace.owner)
              </div>
              <div>{"}"}</div>
            </div>

            {/* Result cards */}
            <div className="grid grid-cols-3 gap-2">
              {[
                ["FLAGGED", "8", "text-warning"],
                ["ROTATE", "3", "text-danger"],
                ["AUTO-REVOKED", "1", "text-success"],
              ].map(([l, v, c]) => (
                <div className="ws-panel p-2.5" key={l}>
                  <div className="mono mb-1 text-[9px] text-muted">{l}</div>
                  <div className={`display text-[22px] ${c}`}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right rail — live telemetry */}
          <div className="col-span-3 hidden p-4 md:block">
            <div className="label mb-2 text-[9px] text-muted">TELEMETRY</div>
            <div className="mono mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
              <div>
                <div className="text-muted">tokens</div>
                <div className="text-ink">142,884</div>
              </div>
              <div>
                <div className="text-muted">latency</div>
                <div className="text-ink">184ms</div>
              </div>
              <div>
                <div className="text-muted">cost</div>
                <div className="text-ink">$0.42</div>
              </div>
              <div>
                <div className="text-muted">policy</div>
                <div className="text-ink">strict</div>
              </div>
            </div>
            <div className="label mb-2 text-[9px] text-muted">ACTIVITY</div>
            <div className="space-y-2">
              {[
                ["12s", "Core", "flagged 8 grants"],
                ["1m", "Policy", "enforced residency"],
                ["3m", "Maria R.", "approved rotation"],
                ["6m", "Connector", "synced okta"],
              ].map(([t, who, what], i) => (
                <div
                  className="mono flex items-start gap-1.5 text-[10px]"
                  key={i}
                >
                  <span className="w-5 shrink-0 text-faint">{t}</span>
                  <span className="text-body">
                    <span className="text-ink">{who}</span> {what}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Hero ===== */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Scroll-driven: sphere drifts as user scrolls
  const sphereY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const sphereScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.84]);
  const sphereOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Assembly sequence — 5 phases, each layer enters after the previous
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const steps = [
      { delay: 500, phase: 1 }, // outer wireframe
      { delay: 1050, phase: 2 }, // inner grid
      { delay: 1600, phase: 3 }, // core shader
      { delay: 2100, phase: 4 }, // orbit rings
      { delay: 2700, phase: 5 }, // particles + full bloom
    ];
    const timers = steps.map(({ delay, phase: p }) =>
      setTimeout(() => setPhase(p), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section
      className="relative w-full overflow-x-clip bg-canvas"
      ref={sectionRef}
    >
      <Nav />

      {/* ── SPHERE — covers full section height, behind everything ── */}
      <motion.div
        className="pointer-events-none absolute top-0 right-[-18%] bottom-0 z-0 w-[72%]"
        style={{ y: sphereY, scale: sphereScale, opacity: sphereOpacity }}
      >
        <NebulaScene phase={phase} />
        {/* Right-edge fade */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 80% 50%, transparent 50%, #07080c 92%)",
          }}
        />
      </motion.div>

      {/* ── HERO VIEWPORT: side-by-side layout ── */}
      <div className="relative z-10 flex min-h-[80svh] flex-row items-center justify-start">
        {/* Subtle grid — canvas layer */}
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />

        {/* Left-to-center gradient veil: makes text pop against sphere */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #07080c 35%, rgba(7,8,12,0.75) 58%, rgba(7,8,12,0) 100%)",
          }}
        />

        {/* ── TEXT PANEL — left, aligned to the same max-w grid as all sections ── */}
        <div className="pointer-events-none relative z-20 mx-auto w-full max-w-[1280px] px-6">
          <motion.div
            className="pointer-events-auto w-full flex-shrink-0 pt-28 md:w-[480px] md:pt-0 lg:w-[560px]"
            style={{ y: textY, opacity: textOpacity }}
          >
            {/* Category eyebrow */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="label mb-6 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-white/[0.025] px-3.5 py-1.5 text-[11px] text-body"
              initial={{ opacity: 0, y: 10 }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.3,
              }}
            >
              <span aria-hidden="true" className="dot dot-violet" />
              <span>Operational Intelligence Layer</span>
            </motion.div>

            {/* Headline */}
            <h1 className="display hero-heading mb-6 text-[clamp(44px,6.4vw,100px)]">
              <SplitHeading delay={0.45} text="Clarity from" />
              <SplitHeading accent delay={0.6} text="complexity." />
            </h1>

            {/* Subhead */}
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 max-w-[400px] text-[16px] text-body leading-[1.6]"
              initial={{ opacity: 0, y: 10 }}
              transition={{
                delay: 1.1,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              The operational intelligence platform that connects your systems,
              events, and AI agents to deliver real-time clarity and governance.
            </motion.p>

            {/* CTAs */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mb-10 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 10 }}
              transition={{
                delay: 1.4,
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <a className="btn-primary group" href="#join">
                <span>Start building</span>
                <svg
                  className="opacity-70 transition-transform group-hover:translate-x-0.5"
                  height="14"
                  viewBox="0 0 14 14"
                  width="14"
                >
                  <path
                    d="M1 7h12M8 2l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.4"
                  />
                </svg>
              </a>
              <a className="btn-ghost" href="#platform">
                <span>View demo</span>
              </a>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              animate={{ opacity: 1 }}
              className="label flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-muted"
              initial={{ opacity: 0 }}
              transition={{ delay: 1.8, duration: 0.8 }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="dot dot-success" />
                SOC 2 II
              </span>
              <span className="h-2.5 w-px bg-white/10" />
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="dot dot-violet" />
                Self-hosted
              </span>
              <span className="h-2.5 w-px bg-white/10" />
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="dot dot-cyan" />
                BYOK
              </span>
              <span className="h-2.5 w-px bg-white/10" />
              <span>99.99% uptime</span>
            </motion.div>

            {/* Phase indicator — shows assembly progress */}
            <AssemblyIndicator phase={phase} />
          </motion.div>
        </div>

        {/* Corner crosshairs */}
        <Crosshairs />
      </div>

      {/* ── HERO SHELL — product proof below fold ── */}
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 mx-auto max-w-[1100px] px-6 pb-20"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ delay: 2.4, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      >
        <HeroShell />
      </motion.div>

      <ProofStrip />
    </section>
  );
}
