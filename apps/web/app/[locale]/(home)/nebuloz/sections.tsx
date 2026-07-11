"use client";

import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { OrbFallback, SceneMount } from "./scene-mount";
import { WorkspaceShell } from "./workspace";

const CoreScene = dynamic(
  () => import("./scene").then((m) => ({ default: m.CoreScene })),
  { ssr: false }
);

/* ===== Proof strip — names rendered as monogram tokens ===== */
export function ProofStrip() {
  const items = [
    "STRATA",
    "KORE",
    "ANTRA",
    "NORTHWAVE",
    "OBSIDIAN",
    "AXIOM·9",
    "LATERAL",
    "KOSMOS",
    "DELTA·SYNTH",
    "PIVOT",
    "KERN",
    "METRIC LABS",
  ];
  return (
    <section className="relative border-hairline border-b bg-transparent">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-8 md:flex-row md:items-center">
        <div className="shrink-0 md:w-48">
          <div className="label mb-1 text-muted">DEPLOYED AT</div>
          <div className="text-[12px] text-body">12 design-led teams</div>
        </div>
        <div className="marquee flex-1">
          <div className="marquee-inner">
            {[...items, ...items].map((n, i) => (
              <span
                className="mono inline-flex shrink-0 items-center rounded-full border border-white/[0.09] bg-white/[0.02] px-4 py-1.5 text-[11px] text-body tracking-[0.12em]"
                key={i}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== Convictions — 3 cards explaining the platform principles ===== */
export function Convictions() {
  const items = [
    {
      label: "MODEL",
      title: "Sovereign AI Factory",
      text: "Deploy models inside your perimeter. BYOK encryption, per-workspace residency, and zero data retention. Every inference is scoped, attributed, and auditable.",
      bullets: ["BYOK + VPC", "Residency", "Zero training"],
      icon: ShieldIcon,
      accent: "var(--c-violet)",
    },
    {
      label: "PLANNER",
      title: "Agentic Orchestration",
      text: "Decompose intent into a supervised DAG of typed tool-calls. The planner diffs before commit, replays on demand, and routes across models by policy.",
      bullets: ["Typed retrieval", "Diff-first", "Multi-model"],
      icon: LensIcon,
      accent: "var(--c-indigo)",
    },
    {
      label: "POLICY",
      title: "Governance Engine",
      text: "Declarative rules for who, what, where, when. SOC 2 Type II, ISO 27001, LGPD, GDPR. Every signal logged, every action attributable.",
      bullets: ["Policy as code", "Compliance", "Audit trail"],
      icon: GridIcon,
      accent: "var(--c-cyan)",
    },
  ];
  return (
    <section className="relative py-32 md:py-40" id="platform">
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHead
          a="Sovereign AI factory."
          b="Governed orchestration."
          desc="Three primitives compose the Nebuloz stack: a sovereign model layer, an agentic planner, and a governance engine. Each runs independently. Together they form a governed intelligence fabric."
          dot="violet"
          eyebrow="SECTION · 01 / CAPABILITIES"
        />

        <div className="grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <ConvictionCard i={i} it={it} key={it.title} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface ConvictionItem {
  label: string;
  title: string;
  text: string;
  bullets: string[];
  icon: React.ComponentType;
  accent: string;
}

function ConvictionCard({ it, i }: { it: ConvictionItem; i: number }) {
  const Icon = it.icon;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [hovered, setHovered] = useState(false);

  const rotX = useMotionValue(0),
    rotY = useMotionValue(0);
  const sRotX = useSpring(rotX, { stiffness: 280, damping: 22 });
  const sRotY = useSpring(rotY, { stiffness: 280, damping: 22 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    rotX.set(((e.clientY - r.top) / r.height - 0.5) * -10);
    rotY.set(((e.clientX - r.left) / r.width - 0.5) * 10);
  };
  const onLeave = () => {
    rotX.set(0);
    rotY.set(0);
    setHovered(false);
  };

  return (
    <div style={{ perspective: "1000px" }}>
      <motion.div
        animate={inView ? { opacity: 1, y: 0 } : {}}
        className="grad-shell h-full"
        initial={{ opacity: 0, y: 24 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={onLeave}
        onMouseMove={onMove}
        ref={ref}
        style={
          {
            rotateX: sRotX,
            rotateY: sRotY,
            transformStyle: "preserve-3d",
            "--accent": it.accent,
          } as React.CSSProperties
        }
        transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="grad-shell-inner group relative flex h-full flex-col overflow-hidden p-8">
          {/* Top accent rule — this card's hue, brightens on hover */}
          <motion.div
            animate={{ opacity: hovered ? 0.9 : 0.25 }}
            className="pointer-events-none absolute top-0 right-0 left-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--accent), transparent)",
            }}
            transition={{ duration: 0.35 }}
          />

          {/* Corner glow in the card's hue */}
          <div
            className="-top-20 -right-20 pointer-events-none absolute h-56 w-56 rounded-full opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background: "radial-gradient(circle, var(--accent), transparent 62%)",
            }}
          />

          {/* Icon + role tag */}
          <div className="mb-7 flex items-center justify-between">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white/[0.04]"
              style={{
                color: hovered ? "var(--accent)" : "var(--c-ink, #fff)",
                borderColor: hovered
                  ? "var(--accent)"
                  : "rgba(255,255,255,0.14)",
                boxShadow: hovered ? "0 0 22px -4px var(--accent)" : "none",
                transition:
                  "border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease",
              }}
            >
              <Icon />
            </div>
            <span
              className="mono text-[10px] tracking-[0.2em]"
              style={{ color: "var(--accent)", opacity: 0.85 }}
            >
              {it.label}
            </span>
          </div>

          {/* Title — solid for legibility, with an accent tick as signature */}
          <h3 className="display mb-3 text-[34px] leading-[0.98] text-ink">
            {it.title}
          </h3>
          <div
            className="mb-5 h-[2px] w-9 rounded-full transition-all duration-500 group-hover:w-14"
            style={{ background: "var(--accent)" }}
          />

          <p className="mb-7 text-[15px] text-body leading-[1.6]">{it.text}</p>

          {/* Capability chips */}
          <ul className="mt-auto flex flex-wrap gap-2 border-hairline border-t pt-6">
            {it.bullets.map((b) => (
              <li
                className="mono inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[11px] text-body"
                key={b}
              >
                <span
                  className="h-1 w-1 shrink-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 22 22" width="22">
      <path
        d="M11 2L3 5v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V5l-8-3z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="M7.5 11l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}
function LensIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 22 22" width="22">
      <circle
        cx="9.5"
        cy="9.5"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M14.5 14.5L19 19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
      <path
        d="M9.5 6.5v6M6.5 9.5h6"
        opacity=".7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 22 22" width="22">
      <rect
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
        width="7"
        x="3"
        y="3"
      />
      <rect
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
        width="7"
        x="12"
        y="3"
      />
      <rect
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
        width="7"
        x="3"
        y="12"
      />
      <rect
        height="7"
        opacity=".4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
        width="7"
        x="12"
        y="12"
      />
    </svg>
  );
}

/* ===== Workspace mockup — the visual centerpiece ===== */
export function Workspace() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="relative py-32 md:py-40" ref={ref}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, rgba(124,108,255,0.08), transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-6">
        <SectionHead
          a="The workspace."
          b="Where signal converges."
          desc="A typed graph of operations, a context-aware editor, and a live telemetry rail. The same surface for engineering, ops, and security."
          dot="cyan"
          eyebrow="SECTION · 02 / PRODUCT"
        />

        <motion.div className="ws-shell p-3 md:p-5" style={{ y }}>
          <WorkspaceShell inView={inView} />
        </motion.div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              l: "Latency · p95",
              v: "184ms",
              d: "Across 4 regions",
              badge: "Top 1% globally",
            },
            {
              l: "Token spend",
              v: "–43%",
              d: "vs. monolithic LLM use",
              badge: "3× industry avg",
            },
            {
              l: "Replay coverage",
              v: "100%",
              d: "Every run is auditable",
              badge: "Industry first",
            },
          ].map((m) => (
            <motion.div
              className="grad-shell group cursor-default"
              key={m.l}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              whileHover={{ y: -4 }}
            >
              <div
                className="grad-shell-inner relative overflow-hidden p-7"
                style={{
                  background: "linear-gradient(160deg, #0f1320, #0a0d16)",
                  borderRadius: "18px",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(70% 50% at 50% 0%, rgba(124,108,255,0.16), transparent)",
                  }}
                />
                <div className="mono absolute top-5 right-5 inline-flex items-center whitespace-nowrap rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[9px] text-muted">
                  {m.badge}
                </div>
                <div className="label mb-4 text-muted">{m.l}</div>
                <div className="display hero-heading grad-text mb-2 text-[44px] leading-none">
                  {m.v}
                </div>
                <div className="mono text-[11px] text-muted">{m.d}</div>
                <div
                  className="absolute right-0 bottom-0 left-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--c-violet), var(--c-cyan), transparent)",
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===== MetaBrain — second 3D scene + descriptive copy ===== */
export function MetaBrain() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  return (
    <section
      className="relative overflow-hidden py-32 md:py-40"
      id="metabrain"
      ref={ref}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 20% 40%, rgba(91,140,255,0.10), transparent 60%), radial-gradient(50% 50% at 90% 70%, rgba(60,195,255,0.07), transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-6">
        <div className="grid items-center gap-8 md:grid-cols-12">
          <div className="order-2 md:order-1 md:col-span-6">
            <div className="label mb-4 flex items-center gap-2 text-muted">
              <span aria-hidden="true" className="dot dot-cyan" />
              <span>SECTION · 04 / METABRAIN</span>
            </div>
            <h2 className="display hero-heading mb-6 text-[clamp(42px,5.8vw,88px)]">
              <span className="grad-text">The second brain</span>
              <br />
              <span className="accent-text">
                your org never had
                <br />
                time to build.
              </span>
            </h2>
            <p className="mb-7 max-w-lg text-[16px] text-body leading-[1.6]">
              MetaBrain compresses the institutional knowledge of your team —
              every decision, every retro, every architecture note — into a
              queryable graph. Like a colleague who&apos;s been on every project
              since the company started.
            </p>

            <div className="mb-8 space-y-3">
              {[
                [
                  "Decisions",
                  "Track who decided what, why, and what changed since.",
                ],
                [
                  "Provenance",
                  "Every answer carries its sources, version, and signer.",
                ],
                [
                  "Drift",
                  "Surfaces contradictions between current and historical context.",
                ],
              ].map(([t, d], i) => (
                <motion.div
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  key={t}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                >
                  <span className="mt-1.5 h-px w-6 bg-white/30" />
                  <div>
                    <div className="mb-0.5 font-medium text-[14px] text-ink">
                      {t}
                    </div>
                    <div className="text-[13px] text-body">{d}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <a className="btn-ghost" href="#">
              <span>Read the architecture note</span>
              <svg height="13" viewBox="0 0 14 14" width="13">
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
          </div>

          <div className="order-1 md:order-2 md:col-span-6">
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-hairline bg-canvas">
              {/* Subtle cyan grid overlay */}
              <div
                className="pointer-events-none absolute inset-0 z-[2]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(60,195,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(60,195,255,0.04) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <SceneMount className="absolute inset-0" fallback={<OrbFallback />}>
                <CoreScene />
              </SceneMount>
              {/* Vignette + dim — tames CoreScene bloom so it reads as an orb, not static */}
              <div
                className="pointer-events-none absolute inset-0 z-[3]"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(7,8,12,0.28) 0%, rgba(7,8,12,0.5) 52%, rgba(7,8,12,0.94) 100%)",
                }}
              />
              {/* HUD overlays */}
              <div className="mono absolute top-4 right-4 left-4 z-10 flex items-center justify-between text-[10px] text-white/60">
                <span>METABRAIN · v2.4</span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="dot dot-success" /> ACTIVE
                </span>
              </div>
              <div className="mono absolute right-4 bottom-4 left-4 z-10 flex items-end justify-between text-[10px] text-white/40">
                <div>
                  <div>NODES · 38,402</div>
                  <div>EDGES · 142,884</div>
                </div>
                <div className="text-right">
                  <div>SOURCES · 4,219</div>
                  <div>DRIFT · 0.034</div>
                </div>
              </div>
              {/* crosshair */}
              <div className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 z-10">
                <svg
                  className="text-white/20"
                  height="80"
                  viewBox="0 0 80 80"
                  width="80"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeDasharray="2 4"
                    strokeWidth="0.5"
                  />
                  <line
                    stroke="currentColor"
                    strokeWidth="0.5"
                    x1="40"
                    x2="40"
                    y1="0"
                    y2="14"
                  />
                  <line
                    stroke="currentColor"
                    strokeWidth="0.5"
                    x1="40"
                    x2="40"
                    y1="66"
                    y2="80"
                  />
                  <line
                    stroke="currentColor"
                    strokeWidth="0.5"
                    x1="0"
                    x2="14"
                    y1="40"
                    y2="40"
                  />
                  <line
                    stroke="currentColor"
                    strokeWidth="0.5"
                    x1="66"
                    x2="80"
                    y1="40"
                    y2="40"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== Modules — capability rhythm grid ===== */
export function Modules() {
  const items = [
    {
      name: "Connectors",
      desc: "Typed sync to GitHub, Linear, Okta, Snowflake, Datadog, Notion, and 40+ more.",
      kind: "edge",
    },
    {
      name: "Policy",
      desc: "Declarative rules: residency, retention, scope, allowed models, required signers.",
      kind: "core",
    },
    {
      name: "Planner",
      desc: "Decomposes intent into a DAG of typed steps. Diffs before commit, replays on demand.",
      kind: "core",
    },
    {
      name: "Surfaces",
      desc: "A workspace, a CLI, and a typed API. Same graph, three audiences.",
      kind: "out",
    },
    {
      name: "Telemetry",
      desc: "Every token, latency, cost, decision and signer logged into an auditable stream.",
      kind: "edge",
    },
    {
      name: "Governance",
      desc: "SOC 2, ISO 27001, LGPD, GDPR. SSO, RBAC, BYOK, and per-region residency.",
      kind: "edge",
    },
  ];
  return (
    <section className="relative py-32 md:py-40" id="modules">
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHead
          a="The system, broken open."
          b="Use any piece. Replace any piece."
          desc="Nebuloz is composable. Run only the connectors and surfaces you need today; add planner and policy when the team is ready. Nothing is bundled, nothing is hidden."
          dot="violet"
          eyebrow="SECTION · 05 / MODULES"
        />

        <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline md:grid-cols-3">
          {items.map((it, i) => (
            <ModuleCell i={i} it={it} key={it.name} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleCell({
  it,
  i,
}: {
  it: { name: string; desc: string; kind: string };
  i: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5%" });
  return (
    <motion.div
      animate={inView ? { opacity: 1, y: 0 } : {}}
      className="group relative bg-canvas p-7"
      initial={{ opacity: 0, y: 20 }}
      ref={ref}
      transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, rgba(124,108,255,0.08), transparent 60%)",
        }}
      />
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline-strong bg-white/[0.03]">
          <span
            className={`dot ${it.kind === "core" ? "dot-violet" : it.kind === "out" ? "dot-success" : "dot-cyan"}`}
          />
        </div>
        <span className="label text-muted">
          {String(i + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="display mb-2 text-[24px]">{it.name}</h3>
      <p className="text-[14px] text-body leading-relaxed">{it.desc}</p>
      <div className="mono mt-6 flex items-center gap-2 text-[12px] text-muted transition-colors group-hover:text-body">
        <span>View module</span>
        <svg
          className="transition-transform group-hover:translate-x-1"
          height="11"
          viewBox="0 0 14 14"
          width="11"
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
      </div>
    </motion.div>
  );
}

/* ===== Numbers — calm stats band ===== */
function StatCard({
  s,
  i,
}: {
  s: { v: string; l: string; d: string };
  i: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      className="relative overflow-hidden bg-surface p-7 md:p-9"
      initial={{ opacity: 0, y: 14 }}
      onHoverEnd={() => setHovered(false)}
      onHoverStart={() => setHovered(true)}
      transition={{ duration: 0.5, delay: i * 0.08 }}
      viewport={{ once: true, margin: "-10%" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {/* Beam sweep */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            animate={{ left: "calc(100% + 140px)" }}
            className="pointer-events-none absolute inset-y-0"
            exit={{ opacity: 0 }}
            initial={{ left: -140 }}
            style={{
              width: 140,
              background:
                "linear-gradient(90deg, transparent, var(--c-violet), var(--c-cyan), transparent)",
              opacity: 0.16,
            }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Bottom accent line */}
      <motion.div
        animate={{ opacity: hovered ? 0.65 : 0 }}
        className="pointer-events-none absolute right-0 bottom-0 left-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--c-violet), var(--c-cyan), transparent)",
        }}
        transition={{ duration: 0.3 }}
      />

      <div className="hero-heading grad-text relative z-10 mb-1.5 text-[clamp(52px,6vw,84px)]">
        <AnimatedNumber value={s.v} />
      </div>
      <div className="relative z-10 mb-0.5 text-[13px] text-ink">{s.l}</div>
      <div className="mono relative z-10 text-[12px] text-muted">{s.d}</div>
    </motion.div>
  );
}

function AnimatedNumber({ value }: { value: string }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(spanRef, { once: true, amount: 0.8 });
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (!inView) return;
    const match = value.match(/^([\d.]+)(.*)$/);
    if (!match) {
      setDisplay(value);
      return;
    }
    const target = Number.parseFloat(match[1]);
    const suffix = match[2];
    if (target === 0) return;
    const duration = 1500;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - p) ** 4;
      const cur = target * eased;
      setDisplay(
        (value.includes(".")
          ? cur.toFixed(value.split(".")[1].length)
          : Math.round(cur).toString()) + suffix
      );
      if (p < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    };
    requestAnimationFrame(tick);
  }, [inView]);
  return <span ref={spanRef}>{display}</span>;
}

export function Numbers() {
  const stats = [
    { v: "38M", l: "Decisions logged", d: "across all customers, last 90d" },
    { v: "99.99", l: "Uptime SLA", d: "compute · storage · planner" },
    { v: "4", l: "Compliance regimes", d: "SOC 2 · ISO · LGPD · GDPR" },
    { v: "0", l: "Tenant data trained", d: "never used to train models" },
  ];
  return (
    <section className="relative border-hairline border-y bg-surface py-24">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid grid-cols-2 gap-px bg-hairline md:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard i={i} key={s.l} s={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===== CTA ===== */
export function CTA() {
  return (
    <section className="relative overflow-hidden py-32 md:py-44" id="join">
      <div className="absolute inset-0">
        <SceneMount className="h-full w-full" fallback={<OrbFallback />}>
          <CoreScene />
        </SceneMount>
      </div>
      <div className="grain-overlay" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(7,8,12,0) 0%, rgba(7,8,12,0.6) 50%, rgba(7,8,12,1) 80%)",
        }}
      />

      <div className="relative mx-auto max-w-[1100px] px-6 text-center">
        <div className="label mb-6 inline-flex items-center gap-2 text-muted">
          <span aria-hidden="true" className="dot dot-violet" />
          <span>EARLY ACCESS · COHORT 03</span>
        </div>
        <h2 className="display hero-heading mb-7 text-[clamp(52px,7.5vw,116px)]">
          <span className="grad-text">Structure your</span>
          <br />
          <span className="accent-text">intelligence.</span>
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-[18px] text-body leading-[1.55]">
          We onboard six teams per cohort. Tell us where your operations
          friction is loudest — we&apos;ll mock the first run against your
          stack.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            className="btn-primary"
            href="#"
            style={{
              background:
                "linear-gradient(180deg, rgba(7,8,12,0.82), rgba(7,8,12,0.72))",
              backdropFilter: "blur(12px)",
              borderColor: "rgba(255,255,255,0.18)",
            }}
          >
            <span>Start building</span>
            <svg height="14" viewBox="0 0 14 14" width="14">
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
          <a
            className="btn-ghost"
            href="#"
            style={{
              background: "rgba(7,8,12,0.65)",
              backdropFilter: "blur(12px)",
              borderColor: "rgba(255,255,255,0.14)",
            }}
          >
            Book an architecture call
          </a>
        </div>

        <div className="mono mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 whitespace-nowrap text-[12px] text-muted">
          <span>14-day mock run</span>
          <span className="h-3 w-px bg-white/10" />
          <span>No data leaves your VPC</span>
          <span className="h-3 w-px bg-white/10" />
          <span>Architecture review included</span>
        </div>
      </div>
    </section>
  );
}

/* ===== Reusable section head ===== */
function SectionHead({
  eyebrow,
  dot = "violet",
  a,
  b,
  desc,
}: {
  eyebrow: string;
  dot?: string;
  a: string;
  b: string;
  desc: string;
}) {
  return (
    <div className="mb-16 grid gap-8 md:grid-cols-12">
      <div className="md:col-span-7">
        <div className="label mb-4 flex items-center gap-2 text-muted">
          <span aria-hidden="true" className={`dot dot-${dot}`} />
          <span>{eyebrow}</span>
        </div>
        <h2 className="display display-tight text-[clamp(40px,5.2vw,76px)]">
          <span className="grad-text">{a}</span>
          <br />
          <span className="accent-text">{b}</span>
        </h2>
      </div>
      <div className="self-end md:col-span-5">
        <p className="max-w-md text-[17px] text-body leading-[1.55]">{desc}</p>
      </div>
    </div>
  );
}

/* ===== Platform Architecture — "Inside Nebuloz" ===== */
export function PlatformArch() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  const modules = [
    {
      name: "Cosmos",
      role: "Operational workspace",
      badge: "Core product",
      badgeColor: "dot-violet",
      featured: true,
      desc: "The workspace where you model operational domains, define AI agents, and see how every part of your operation connects in real time.",
      bullets: [
        "Visual graph of your operational fabric",
        "Domain modeling + agent definition",
        "Live event stream + state diffs",
        "Drill into any node to see context",
      ],
    },
    {
      name: "Core",
      role: "Orchestration engine",
      badge: "Runtime",
      badgeColor: "dot-indigo",
      featured: false,
      desc: "The orchestrator that routes intent, applies policy, composes model calls, and replays every run with full attribution.",
      bullets: [
        "Policy-gated model composition",
        "Replayable run graph",
        "Diff-first action commits",
      ],
    },
    {
      name: "Governance",
      role: "Compliance + audit layer",
      badge: "Control plane",
      badgeColor: "dot-success",
      featured: false,
      desc: "Declarative rules for who can do what, where, and when. Every action logged, attributable, and auditable.",
      bullets: [
        "SOC 2 · ISO 27001 · LGPD · GDPR",
        "RBAC + scoped credentials",
        "Immutable audit log",
      ],
    },
  ];

  return (
    <section className="relative border-hairline border-t py-20" ref={ref}>
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="label mb-3 flex items-center gap-2 text-muted">
              <span aria-hidden="true" className="dot dot-violet" />
              <span>INSIDE NEBULOZ</span>
            </div>
            <h2 className="display display-tight max-w-lg text-[clamp(28px,3.6vw,48px)]">
              <span className="grad-text">One platform.</span>{" "}
              <span className="accent-text">Three layers.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[15px] text-body leading-relaxed md:text-right">
            Nebuloz is the platform. Cosmos is the workspace you open every day.
            Core and Governance run underneath so every action is governed and
            replayable.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((m, i) => (
            <div
              className={`reveal-card relative flex flex-col gap-4 rounded-[18px] border p-7 ${
                m.featured
                  ? "border-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.015]"
                  : "border-hairline bg-white/[0.018]"
              }`}
              key={m.name}
            >
              {m.featured && (
                <div className="-top-px absolute right-6 left-6 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              )}
              <div className="flex items-start justify-between">
                <div>
                  <div className="display mb-0.5 text-[26px]">{m.name}</div>
                  <div className="text-[13px] text-muted">{m.role}</div>
                </div>
                <div
                  className={`label inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-white/[0.03] px-2.5 py-1 text-[11px] ${m.featured ? "text-ink" : "text-muted"}`}
                >
                  <span className={`dot ${m.badgeColor}`} />
                  <span>{m.badge}</span>
                </div>
              </div>
              <p className="text-[14px] text-body leading-[1.6]">{m.desc}</p>
              <ul className="mt-auto space-y-2 border-hairline border-t pt-4">
                {m.bullets.map((b) => (
                  <li
                    className="mono flex items-center gap-2.5 text-[12.5px] text-muted"
                    key={b}
                  >
                    <svg
                      className="shrink-0 text-white/30"
                      height="8"
                      viewBox="0 0 8 8"
                      width="8"
                    >
                      <path
                        d="M0 4h6m-2-2 2 2-2 2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
              {m.featured && (
                <a
                  className="mono mt-1 inline-flex items-center gap-2 text-[12px] text-body transition-colors hover:text-ink"
                  href="#platform"
                >
                  <span>Open Cosmos</span>
                  <svg height="11" viewBox="0 0 14 14" width="11">
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
              )}
            </div>
          ))}
        </div>

        <div className="mono mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-white/[0.01] p-4 text-[12px] text-muted">
          <span className="text-ink">Nebuloz</span>
          <span className="text-white/20">→</span>
          <span>Cosmos</span>
          <span className="mx-1 h-3 w-px bg-white/15" />
          <span>Core</span>
          <span className="mx-1 h-3 w-px bg-white/15" />
          <span>Governance</span>
          <span className="mx-1 text-white/20">→</span>
          <span>your stack</span>
          <span className="ml-auto hidden text-white/30 md:block">
            Cosmos is the workspace · Nebuloz is the platform
          </span>
        </div>
      </div>
    </section>
  );
}
