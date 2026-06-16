"use client";

import { Button } from "@repo/design-system/components/ui/button";
import type { Dictionary } from "@repo/internationalization";
import { motion, useScroll, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef } from "react";
import { AnimatedBar } from "@/components/cosmos/animated-counter";
import { PulseDot } from "@/components/cosmos/draw-line";
import { MorphNumber } from "@/components/cosmos/morph-number";
import { RevealBlock, SplitText } from "@/components/cosmos/split-text";
import { env } from "@/env";

const HeroCanvas = dynamic(
  () =>
    import("@/components/cosmos/hero-canvas").then((m) => ({
      default: m.HeroCanvas,
    })),
  { ssr: false }
);

type HeroProps = { dictionary: Dictionary };

const ARTS = [
  {
    name: "ART-1: Payments Platform",
    cap: 85,
    features: [
      { n: "API Gateway v3", c: "var(--accent)", dep: true },
      { n: "Auth Service", c: "var(--success)", dep: false },
      { n: "Rate Limiting", c: "var(--info)", dep: false },
    ],
  },
  {
    name: "ART-2: Core Platform",
    cap: 92,
    features: [
      { n: "Event Bus Refactor", c: "var(--warning)", dep: true },
      { n: "DB Migration", c: "var(--accent)", dep: false },
    ],
  },
  {
    name: "ART-3: Mobile & UX",
    cap: 68,
    features: [
      { n: "Design System v2", c: "var(--info)", dep: true },
      { n: "Onboarding Flow", c: "var(--success)", dep: false },
      { n: "Analytics SDK", c: "var(--accent)", dep: false },
    ],
  },
] as const;

function CapBar({ value }: { value: number }) {
  const color =
    value > 90
      ? "var(--danger)"
      : value > 80
        ? "var(--warning)"
        : "var(--success)";
  return (
    <div className="flex items-center gap-2">
      <AnimatedBar color={color} delay={0.4} height={5} value={value} />
      <span
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color,
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {value}%
      </span>
    </div>
  );
}

export const Hero = ({ dictionary: _ }: HeroProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const mockupOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.3]);

  return (
    <section
      className="bloom-hero cosmos-grid relative w-full overflow-hidden"
      ref={containerRef}
      style={{ minHeight: "100vh" }}
    >
      {/* 3D Canvas — particles + distorted orb */}
      <HeroCanvas />

      {/* ── Copy ── */}
      <div className="relative mx-auto max-w-7xl px-5 pt-24 pb-0 md:px-20 md:pt-32">
        {/* Eyebrow */}
        <RevealBlock delay={0}>
          <div className="badge-accent mb-8 w-fit">
            <PulseDot color="var(--accent)" />
            Cosmos by Nebuloz — SAFe 6.0 + AI
          </div>
        </RevealBlock>

        {/* H1 — split-text reveal */}
        <h1
          style={{
            fontWeight: 700,
            fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            color: "var(--text)",
            maxWidth: 860,
          }}
        >
          <SplitText blur delay={0.05} stagger={0.06}>
            PI Planning
          </SplitText>{" "}
          <SplitText
            blur
            childClassName="text-shimmer"
            delay={0.2}
            stagger={0.06}
          >
            sem caos.
          </SplitText>
          <br />
          <SplitText blur delay={0.35} stagger={0.06}>
            Portfolio com
          </SplitText>{" "}
          <SplitText
            blur
            childClassName="text-shimmer"
            delay={0.5}
            stagger={0.06}
          >
            visibilidade real.
          </SplitText>
        </h1>

        {/* Sub + CTAs */}
        <RevealBlock delay={0.55}>
          <div className="mt-8 flex max-w-lg flex-col gap-6">
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.65,
                color: "var(--text-muted)",
              }}
            >
              Plataforma SaaS para SAFe 6.0 com IA nativa on-premise. Seus dados
              nunca saem do seu perímetro.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <motion.div
                style={{ borderRadius: "var(--radius-md)" }}
                whileHover={{
                  scale: 1.03,
                  boxShadow: "0 0 30px rgba(0,212,255,0.35)",
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  asChild
                  style={{
                    background: "var(--accent)",
                    color: "var(--bg)",
                    fontWeight: 600,
                    fontSize: 15,
                    padding: "13px 28px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                  }}
                >
                  <Link href="/contact">Agendar demo técnica</Link>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{
                  borderColor: "var(--border-accent)",
                  color: "var(--text)",
                }}
              >
                <Button
                  asChild
                  style={{
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontWeight: 400,
                    fontSize: 15,
                    padding: "13px 24px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    transition: "all 220ms ease",
                  }}
                >
                  <Link href={env.NEXT_PUBLIC_APP_URL}>Ver produto →</Link>
                </Button>
              </motion.div>
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-faint)",
                fontStyle: "italic",
              }}
            >
              45 minutos com um RTE. Traga seu PI atual.
            </p>
          </div>
        </RevealBlock>

        {/* Social proof */}
        <RevealBlock delay={0.7}>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              style={{
                fontSize: 11,
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Usado em:
            </span>
            {["Fintech", "Telecom", "Manufatura", "Saúde"].map((s, i) => (
              <motion.span
                animate={{ opacity: 1, x: 0 }}
                className="rounded-full px-3 py-1"
                initial={{ opacity: 0, x: -8 }}
                key={s}
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
                transition={{ delay: 0.72 + i * 0.06, duration: 0.3 }}
              >
                {s}
              </motion.span>
            ))}
          </div>
        </RevealBlock>
      </div>

      {/* ── Product mockup ── */}
      <motion.div
        className="relative mx-auto mt-16 max-w-7xl px-5 md:px-20"
        style={{ y: mockupY, opacity: mockupOpacity }}
      >
        {/* Floating badge — ciclo de planejamento */}
        <motion.div
          animate={{ opacity: 1, x: 0, scale: 1 }}
          className="absolute z-20 hidden md:block"
          initial={{ opacity: 0, x: -20, scale: 0.85 }}
          style={{ bottom: 80, left: -8 }}
          transition={{ delay: 1.7, duration: 0.45, ease: [0.25, 0, 0, 1] }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-accent)",
              borderRadius: "var(--radius-lg)",
              padding: "10px 14px",
              boxShadow: "var(--shadow-glow)",
              minWidth: 140,
            }}
          >
            <p
              style={{
                fontSize: 9,
                color: "var(--text-faint)",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Ciclo de Planejamento
            </p>
            <div className="mt-1 flex items-baseline gap-1">
              <MorphNumber
                from={21}
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 28,
                  lineHeight: 1,
                }}
                to={2}
              />
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "var(--text-faint)",
                }}
              >
                dias
              </span>
            </div>
            <p
              style={{
                fontSize: 10,
                color: "var(--success)",
                fontFamily: "monospace",
                marginTop: 3,
              }}
            >
              ↓ 90% com IA
            </p>
          </div>
        </motion.div>
        {/* Glow */}
        <div
          className="-top-8 pointer-events-none absolute inset-x-0 z-0"
          style={{
            height: 160,
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(0,212,255,0.10) 0%, transparent 70%)",
          }}
        />

        {/* Browser shell */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 overflow-hidden"
          initial={{ opacity: 0, y: 32 }}
          style={{
            borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
            border: "1px solid var(--border)",
            borderBottom: "none",
            background: "var(--bg)",
            boxShadow: "var(--shadow-glow), 0 -4px 60px rgba(0,0,0,0.4)",
          }}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.25, 0, 0, 1] }}
        >
          {/* Chrome */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="flex gap-1.5">
              {["var(--danger)", "var(--warning)", "var(--success)"].map(
                (c, i) => (
                  <span
                    className="h-3 w-3 rounded-full"
                    key={i}
                    style={{ background: c, opacity: 0.7 }}
                  />
                )
              )}
            </div>
            <div
              className="flex flex-1 items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ background: "var(--surface-2)", maxWidth: 260 }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-faint)",
                  fontFamily: "monospace",
                }}
              >
                cosmos.nebuloz.com
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <PulseDot color="var(--success)" />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--success)",
                  fontFamily: "monospace",
                }}
              >
                Live
              </span>
            </div>
          </div>

          {/* App layout */}
          <div className="flex" style={{ minHeight: 480 }}>
            {/* Sidebar */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="hidden flex-col gap-1 p-3 md:flex"
              initial={{ opacity: 0, x: -20 }}
              style={{
                width: 200,
                background: "var(--surface)",
                borderRight: "1px solid var(--border)",
                flexShrink: 0,
              }}
              transition={{ delay: 0.8, duration: 0.4, ease: [0.25, 0, 0, 1] }}
            >
              <div className="mb-3 px-2">
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  Cosmos
                </span>
              </div>
              {[
                "Portfolio",
                "PI Planning",
                "ARTs",
                "Teams",
                "Metrics",
                "AI Insights",
              ].map((item, i) => (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  initial={{ opacity: 0, x: -10 }}
                  key={item}
                  style={{
                    background: i === 1 ? "var(--accent-dim)" : "transparent",
                    border:
                      i === 1
                        ? "1px solid var(--border-accent)"
                        : "1px solid transparent",
                  }}
                  transition={{ delay: 0.85 + i * 0.05 }}
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{
                      background:
                        i === 1 ? "var(--accent)" : "var(--surface-3)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: i === 1 ? "var(--accent)" : "var(--text-faint)",
                    }}
                  >
                    {item}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Main */}
            <div
              className="flex flex-1 flex-col gap-3 p-5"
              style={{ overflow: "hidden" }}
            >
              {/* Header */}
              <motion.div
                animate={{ opacity: 1 }}
                className="flex items-center justify-between"
                initial={{ opacity: 0 }}
                transition={{ delay: 0.9 }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: 14,
                      color: "var(--text)",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    PI-24 Planning Board
                  </h3>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--text-faint)",
                      marginTop: 2,
                      fontFamily: "monospace",
                    }}
                  >
                    3 ARTs · 18 Features · 7 dias
                  </p>
                </div>
                <div className="flex gap-2">
                  {[
                    {
                      label: "⚠ 3 riscos",
                      c: "var(--warning)",
                      bg: "rgba(245,185,66,0.10)",
                      bd: "rgba(245,185,66,0.25)",
                    },
                    {
                      label: "IA ativa",
                      c: "var(--success)",
                      bg: "rgba(41,204,122,0.10)",
                      bd: "rgba(41,204,122,0.25)",
                    },
                  ].map((b) => (
                    <span
                      className="rounded-full px-3 py-1"
                      key={b.label}
                      style={{
                        fontSize: 11,
                        color: b.c,
                        background: b.bg,
                        border: `1px solid ${b.bd}`,
                        fontFamily: "monospace",
                      }}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* ART lanes — staggered */}
              {ARTS.map((art, i) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-3"
                  initial={{ opacity: 0, y: 16 }}
                  key={art.name}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                  transition={{
                    delay: 1.0 + i * 0.12,
                    duration: 0.4,
                    ease: [0.25, 0, 0, 1],
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-faint)",
                        fontFamily: "monospace",
                      }}
                    >
                      {art.name}
                    </span>
                    <div className="w-32">
                      <CapBar value={art.cap} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {art.features.map((f) => (
                      <div
                        className="relative flex-1 rounded-lg p-2"
                        key={f.n}
                        style={{
                          background: "var(--bg)",
                          borderLeft: `3px solid ${f.c}`,
                          minWidth: 0,
                        }}
                      >
                        <p
                          className="truncate"
                          style={{ fontSize: 11, color: "var(--text)" }}
                        >
                          {f.n}
                        </p>
                        {f.dep && (
                          <span
                            style={{
                              fontSize: 9,
                              color: "var(--warning)",
                              fontFamily: "monospace",
                            }}
                          >
                            ⚡ dep
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* AI insight — appears last with glow */}
              <motion.div
                animate={{
                  opacity: 1,
                  y: 0,
                  boxShadow: "0 0 20px rgba(0,212,255,0.12)",
                }}
                className="flex items-start gap-3 rounded-xl p-3"
                initial={{
                  opacity: 0,
                  y: 12,
                  boxShadow: "0 0 0 rgba(0,212,255,0)",
                }}
                style={{
                  background: "var(--accent-dim)",
                  border: "1px solid var(--border-accent)",
                }}
                transition={{
                  delay: 1.4,
                  duration: 0.5,
                  ease: [0.25, 0, 0, 1],
                }}
              >
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  style={{
                    color: "var(--accent)",
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                  transition={{ delay: 1.8, duration: 0.4 }}
                >
                  ⟢
                </motion.span>
                <div className="flex-1">
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--accent)",
                      fontWeight: 500,
                      fontFamily: "monospace",
                    }}
                  >
                    IA detectou dependência crítica: ART-1 → ART-2
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-faint)",
                      marginTop: 2,
                    }}
                  >
                    API Gateway v3 depende de Event Bus Refactor. Sugestão:
                    priorizar sprint 1 do ART-2.
                  </p>
                </div>
                <span
                  className="flex-shrink-0 rounded-lg px-2 py-1"
                  style={{
                    fontSize: 10,
                    color: "var(--accent)",
                    background: "rgba(0,212,255,0.15)",
                    border: "1px solid var(--border-accent)",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  Resolver →
                </span>
              </motion.div>
            </div>

            {/* Metrics panel */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="hidden flex-col gap-4 p-4 lg:flex"
              initial={{ opacity: 0, x: 20 }}
              style={{
                width: 190,
                borderLeft: "1px solid var(--border)",
                flexShrink: 0,
              }}
              transition={{ delay: 1.0, duration: 0.4 }}
            >
              {[
                {
                  label: "PI Progress",
                  value: "67%",
                  delta: "12/18 features",
                  c: "var(--success)",
                },
                {
                  label: "Velocity",
                  value: "42 SP",
                  delta: "↑ 18% vs PI-23",
                  c: "var(--accent)",
                },
                {
                  label: "Predictability",
                  value: "88%",
                  delta: "",
                  c: "var(--text)",
                },
                {
                  label: "Deps. críticas",
                  value: "3",
                  delta: "↓ 12 vs sem IA",
                  c: "var(--warning)",
                },
              ].map((m, i) => (
                <motion.div
                  animate={{ opacity: 1 }}
                  initial={{ opacity: 0 }}
                  key={m.label}
                  transition={{ delay: 1.1 + i * 0.1 }}
                >
                  {i > 0 && (
                    <div
                      className="mb-4 h-px"
                      style={{ background: "var(--border)" }}
                    />
                  )}
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--text-faint)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontFamily: "monospace",
                    }}
                  >
                    {m.label}
                  </p>
                  <p
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: 26,
                      color: m.c,
                      lineHeight: 1.1,
                      marginTop: 4,
                    }}
                  >
                    {m.value}
                  </p>
                  {m.delta && (
                    <p
                      style={{
                        fontSize: 10,
                        color: m.c,
                        fontFamily: "monospace",
                        marginTop: 2,
                      }}
                    >
                      {m.delta}
                    </p>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};
