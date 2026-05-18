"use client";

import { FadeIn, FadeInChild, FadeInGroup } from "@/components/cosmos/fade-in";
import { DrawLine, GraphNode } from "@/components/cosmos/draw-line";
import { TiltCard } from "@/components/cosmos/tilt-card";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { Dictionary } from "@repo/internationalization";

const FeaturesShapes = dynamic(
  () => import("@/components/cosmos/features-shapes").then((m) => ({ default: m.FeaturesShapes })),
  { ssr: false }
);

type FeaturesProps = { dictionary: Dictionary };

const NODES = [
  { cx: 30,  cy: 30, label: "ART-1",  color: "var(--accent)",    delay: 0.0  },
  { cx: 140, cy: 20, label: "ART-2",  color: "var(--success)",   delay: 0.08 },
  { cx: 240, cy: 30, label: "ART-3",  color: "var(--info)",      delay: 0.16 },
  { cx: 85,  cy: 85, label: "Shared", color: "var(--warning)",   delay: 0.24 },
  { cx: 195, cy: 85, label: "Infra",  color: "var(--violet)",    delay: 0.32 },
];

const NEUTRAL_LINES = [
  { d: "M 158 24 L 222 28", color: "var(--success)", delay: 0.3  },
  { d: "M 40 46 L 72 73",   color: "var(--warning)", delay: 0.4, dash: true },
  { d: "M 158 36 L 182 72", color: "var(--violet)",  delay: 0.5  },
  { d: "M 103 85 L 177 85", color: "var(--border)",  delay: 0.6, dash: true },
];

const DependencyMockup = () => (
  <div className="h-full w-full p-4">
    <div className="mb-2">
      <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--accent)" }}>
        Dependency Graph — PI-24
      </span>
    </div>
    <svg viewBox="0 0 280 120" className="w-full" style={{ maxHeight: 120, overflow: "visible" }}>
      {/* Neutral lines — draw after nodes */}
      {NEUTRAL_LINES.map((l) => (
        <DrawLine
          key={l.d}
          d={l.d}
          color={l.color}
          strokeWidth={l.dash ? 1 : 1.5}
          duration={0.8}
          delay={l.delay}
        />
      ))}

      {/* Critical line ART-1 → ART-2: border → accent, then dot travels */}
      <motion.path
        d="M 48 34 L 122 24"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0, stroke: "rgba(255,255,255,0.08)" }}
        whileInView={{
          pathLength: 1,
          opacity: 1,
          stroke: "#00D4FF",
        }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{
          pathLength: { duration: 1.2, delay: 0.9, ease: [0.25, 0, 0, 1] },
          opacity:     { duration: 0.2, delay: 0.9 },
          stroke:      { duration: 0.4, delay: 1.3 },
        }}
      />

      {/* Traveling dot along critical line */}
      <motion.circle
        r={3}
        fill="#00D4FF"
        style={{ filter: "drop-shadow(0 0 3px #00D4FF)" }}
        initial={{ opacity: 0, cx: 48, cy: 34 }}
        whileInView={{
          opacity: [0, 1, 1, 0],
          cx: [48, 48, 122],
          cy: [34, 34, 24],
        }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{
          duration: 0.7,
          delay: 1.6,
          ease: "easeInOut",
          times: [0, 0.05, 1, 1],
          opacity: { duration: 0.7, delay: 1.6, times: [0, 0.1, 0.7, 1] },
        }}
      />

      {/* Nodes — stagger 80ms */}
      {NODES.map((n) => (
        <GraphNode
          key={n.label}
          cx={n.cx}
          cy={n.cy}
          r={18}
          label={n.label}
          color={n.color}
          delay={n.delay}
        />
      ))}

      {/* Critical badge */}
      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ delay: 1.5, duration: 0.3 }}
      >
        <rect x={50} y={50} width={62} height={16} rx={4} fill="rgba(245,185,66,0.12)" stroke="rgba(245,185,66,0.3)" strokeWidth={1} />
        <text x={81} y={61} textAnchor="middle" style={{ fontFamily: "monospace", fontSize: 7, fill: "var(--warning)" }}>⚡ crítico</text>
      </motion.g>
    </svg>

    {/* AI insight badge */}
    <motion.div
      className="mt-3 flex items-center gap-2 rounded-lg p-2"
      style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)" }}
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: 1.5, duration: 0.4, ease: [0.25, 0, 0, 1] }}
    >
      <span style={{ fontFamily: "monospace", fontSize: 9, color: "var(--accent)" }}>
        ⟢ 2 deps críticas — detectadas 7 dias antes do PI
      </span>
    </motion.div>
  </div>
);

const PortfolioMockup = () => (
  <div className="h-full w-full p-4">
    <div className="mb-3 flex items-center justify-between">
      <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-faint)" }}>Portfolio Backlog</span>
      <span style={{ fontFamily: "monospace", fontSize: 9, color: "var(--success)" }}>AI ranked</span>
    </div>
    {[
      { rank: 1, name: "API Gateway v3", score: 94, color: "var(--success)" },
      { rank: 2, name: "Event Bus Refactor", score: 87, color: "var(--accent)" },
      { rank: 3, name: "Auth Service 2.0", score: 72, color: "var(--info)" },
      { rank: 4, name: "Mobile Redesign", score: 58, color: "var(--warning)" },
      { rank: 5, name: "Analytics SDK", score: 41, color: "var(--text-faint)" },
    ].map((item) => (
      <div key={item.name} className="mb-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5"
        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-faint)", width: 14 }}>#{item.rank}</span>
        <span className="flex-1 truncate" style={{ fontSize: 11, color: "var(--text)" }}>{item.name}</span>
        <div className="h-1 rounded-full overflow-hidden" style={{ width: 40, background: "var(--surface-2)" }}>
          <div style={{ height: "100%", width: `${item.score}%`, background: item.color, borderRadius: 9999 }} />
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: item.color, width: 24, textAlign: "right" }}>{item.score}</span>
      </div>
    ))}
  </div>
);

const SLMMockup = () => (
  <div className="h-full w-full p-4">
    <div className="mb-3">
      <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-faint)" }}>SLM Router — Arquitetura</span>
    </div>
    <div className="flex flex-col gap-2">
      {[
        { label: "Backlog do Cliente", color: "var(--text-faint)", model: false },
        { label: "Verificação LGPD", color: "var(--success)", model: false },
        { label: "Llama 3.1 8B (on-prem)", color: "var(--accent)", model: true },
        { label: "Análise de Dependências", color: "var(--info)", model: false },
      ].map((item, i) => (
        <div key={item.label} className="flex flex-col items-center">
          <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: item.model ? "var(--accent-dim)" : "var(--bg)",
              border: `1px solid ${item.model ? "var(--border-accent)" : "var(--border)"}`,
            }}>
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span style={{ fontFamily: "monospace", fontSize: 10, color: item.color }}>{item.label}</span>
            {item.model && (
              <span className="ml-auto" style={{ fontFamily: "monospace", fontSize: 9, color: "var(--accent)" }}>on-prem ✓</span>
            )}
          </div>
          {i < 3 && <div className="h-3 w-px" style={{ background: "var(--border)" }} />}
        </div>
      ))}
      <div className="mt-1 rounded-lg p-2" style={{ background: "rgba(41,204,122,0.05)", border: "1px solid rgba(41,204,122,0.2)" }}>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "var(--success)" }}>
          ✓ Dados não saíram do perímetro · LGPD compliant
        </span>
      </div>
    </div>
  </div>
);

const MetricsMockup = () => (
  <div className="h-full w-full p-4">
    <div className="mb-3">
      <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-faint)" }}>Flow Metrics · ART-1</span>
    </div>
    <div className="grid grid-cols-2 gap-2 mb-3">
      {[
        { label: "Flow Velocity", value: "42 SP", delta: "+18%", c: "var(--accent)" },
        { label: "Predictability", value: "88%", delta: "+12%", c: "var(--success)" },
        { label: "Flow Time", value: "6.2d", delta: "-31%", c: "var(--info)" },
        { label: "Load", value: "85%", delta: "⚠️ alto", c: "var(--warning)" },
      ].map((m) => (
        <div key={m.label} className="rounded-lg p-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "monospace", fontSize: 8, color: "var(--text-faint)", textTransform: "uppercase" }}>{m.label}</p>
          <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 18, color: m.c, lineHeight: 1.2, marginTop: 2 }}>{m.value}</p>
          <p style={{ fontFamily: "monospace", fontSize: 9, color: m.c }}>{m.delta}</p>
        </div>
      ))}
    </div>
    <div className="flex items-end gap-1" style={{ height: 36 }}>
      {[60, 75, 68, 82, 79, 88, 85, 92, 88].map((h, i) => (
        <div key={i} className="flex-1 rounded-sm"
          style={{ height: `${h}%`, background: i === 8 ? "var(--accent)" : "var(--surface-3)" }} />
      ))}
    </div>
    <p style={{ fontFamily: "monospace", fontSize: 9, color: "var(--text-faint)", marginTop: 4 }}>Velocity trend · 9 sprints</p>
  </div>
);

const CARDS = [
  { label: "Dependências Automáticas", title: "IA detecta o que você perderia na reunião.", body: "Mapeamento automático de dependências cross-ART antes do PI. Descubra riscos 7 dias antes.", mockup: DependencyMockup, glowColor: "rgba(0,212,255,0.12)" },
  { label: "Portfolio Prioritization", title: "Priorize 200 iniciativas em 45 minutos.", body: "IA rankeia por WSJF com rastreabilidade. Substitui a reunião de steering de 4h.", mockup: PortfolioMockup, glowColor: "rgba(41,204,122,0.10)" },
  { label: "IA On-Premise", title: "Seus dados ficam nos seus servidores.", body: "SLMs no seu Kubernetes. LGPD por arquitetura. 95% mais barato que APIs de terceiros.", mockup: SLMMockup, glowColor: "rgba(124,108,255,0.10)" },
  { label: "Flow Metrics", title: "SAFe 6.0 metrics em tempo real.", body: "Velocity, Predictability, Flow Time e Load por ART. Dashboard que o CFO entende.", mockup: MetricsMockup, glowColor: "rgba(245,185,66,0.08)" },
] as const;

export const Features = ({ dictionary: _ }: FeaturesProps) => (
  <section className="relative w-full py-24" style={{ background: "var(--bg)" }}>
    <FeaturesShapes />
    <div className="mx-auto max-w-7xl px-5 md:px-20">
      <FadeIn className="mb-14">
        <p className="mb-3" style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Capacidades
        </p>
        <h2 style={{ fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--text)", maxWidth: 560 }}>
          Produtividade que{" "}
          <span style={{ color: "var(--accent)" }}>nenhuma planilha dá.</span>
        </h2>
      </FadeIn>

      <FadeInGroup className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CARDS.map((card) => {
          const Mockup = card.mockup;
          return (
            <FadeInChild key={card.label}>
              <TiltCard
                glowColor={card.glowColor}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
                }}
              >
                {/* Mockup area */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    minHeight: 200,
                    background: "var(--bg)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${card.glowColor} 0%, transparent 70%)`,
                    }}
                  />
                  <Mockup />
                </div>
                {/* Text */}
                <div className="flex flex-col gap-2 p-5">
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {card.label}
                  </span>
                  <h3 style={{ fontWeight: 600, fontSize: 18, color: "var(--text)", lineHeight: 1.3 }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--text-faint)", lineHeight: 1.6 }}>
                    {card.body}
                  </p>
                </div>
              </TiltCard>
            </FadeInChild>
          );
        })}
      </FadeInGroup>
    </div>
  </section>
);
