"use client";
import type { Dictionary } from "@repo/internationalization";
import type { MotionValue } from "framer-motion";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type ChaosOrderProps = { dictionary: Dictionary };

const CARDS = [
  { name: "API Gateway v3", art: "ART-1", color: "#00D4FF" },
  { name: "Auth Service", art: "ART-1", color: "#29cc7a" },
  { name: "Event Bus Refactor", art: "ART-2", color: "#f5b942" },
  { name: "DB Migration", art: "ART-2", color: "#00D4FF" },
  { name: "Design System v2", art: "ART-3", color: "#3B82F6" },
  { name: "Onboarding Flow", art: "ART-3", color: "#29cc7a" },
];

// Positions relative to container center (CSS px). rx = rotateX for 3D depth feel.
const CHAOS = [
  { x: -180, y: -80, r: -12, rx: 8 },
  { x: 60, y: -140, r: 8, rx: -6 },
  { x: 200, y: -20, r: -5, rx: 10 },
  { x: -100, y: 60, r: 15, rx: -8 },
  { x: 140, y: 90, r: -10, rx: 6 },
  { x: -40, y: 120, r: 6, rx: -4 },
];

const ANALYZE = [
  { x: -90, y: -40, r: -4, rx: -2 },
  { x: 30, y: -70, r: 3, rx: 2 },
  { x: 100, y: -20, r: -2, rx: -1 },
  { x: -60, y: 30, r: 4, rx: 3 },
  { x: 70, y: 50, r: -2, rx: -2 },
  { x: -20, y: 70, r: 1, rx: 1 },
];

const ORDERED = [
  { x: -240, y: -50, r: 0, rx: 0 },
  { x: -240, y: 20, r: 0, rx: 0 },
  { x: 0, y: -50, r: 0, rx: 0 },
  { x: 0, y: 20, r: 0, rx: 0 },
  { x: 240, y: -50, r: 0, rx: 0 },
  { x: 240, y: 20, r: 0, rx: 0 },
];

type PhasePos = { x: number; y: number; r: number; rx: number };

function ChaosCard({
  scrollYProgress,
  chaos,
  analyze,
  ordered,
  card,
}: {
  scrollYProgress: MotionValue<number>;
  chaos: PhasePos;
  analyze: PhasePos;
  ordered: PhasePos;
  card: { name: string; art: string; color: string };
}) {
  const x = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    [chaos.x, analyze.x, ordered.x, ordered.x]
  );
  const y = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    [chaos.y, analyze.y, ordered.y, ordered.y]
  );
  const rotate = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    [chaos.r, analyze.r, ordered.r, ordered.r]
  );
  const rotateX = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    [chaos.rx, analyze.rx, 0, 0]
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    [0.88, 1.0, 1.0, 1.0]
  );

  return (
    <motion.div
      style={{
        x,
        y,
        rotate,
        rotateX,
        scale,
        position: "absolute",
        top: "calc(50% - 28px)",
        left: "calc(50% - 70px)",
        willChange: "transform",
        width: 140,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: `1px solid ${card.color}33`,
          borderLeft: `3px solid ${card.color}`,
          borderRadius: "var(--radius-md)",
          padding: "8px 12px",
          boxShadow: `0 2px 12px ${card.color}14`,
        }}
      >
        <p
          style={{
            fontSize: 9,
            color: "var(--text-faint)",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {card.art}
        </p>
        <p
          style={{
            fontSize: 11,
            color: "var(--text)",
            fontWeight: 500,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.name}
        </p>
      </div>
    </motion.div>
  );
}

const ART_LANES = [
  { label: "ART-1: Payments", left: 50 },
  { label: "ART-2: Core", left: 290 },
  { label: "ART-3: Mobile", left: 530 },
];

// SVG connection lines in analyze phase
// Centers of cards in ANALYZE positions, relative to svg (380, 140)
const ANALYSIS_LINES = [
  { x1: 290, y1: 100, x2: 410, y2: 70, color: "rgba(0,212,255,0.55)" },
  {
    x1: 290,
    y1: 100,
    x2: 320,
    y2: 170,
    color: "rgba(245,185,66,0.75)",
    dash: true,
  },
  {
    x1: 480,
    y1: 120,
    x2: 320,
    y2: 170,
    color: "rgba(0,212,255,0.35)",
    dash: true,
  },
  { x1: 450, y1: 190, x2: 360, y2: 210, color: "rgba(59,130,246,0.45)" },
];

export const ChaosOrder = ({ dictionary: _ }: ChaosOrderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const h1Opacity = useTransform(scrollYProgress, [0, 0.28, 0.38], [1, 1, 0]);
  const h2Opacity = useTransform(
    scrollYProgress,
    [0.28, 0.38, 0.58, 0.68],
    [0, 1, 1, 0]
  );
  const h3Opacity = useTransform(scrollYProgress, [0.58, 0.68, 1], [0, 1, 1]);

  const linesOpacity = useTransform(
    scrollYProgress,
    [0.3, 0.44, 0.58, 0.68],
    [0, 1, 1, 0]
  );
  const aiBadgeOpacity = useTransform(
    scrollYProgress,
    [0.34, 0.46, 0.6, 0.68],
    [0, 1, 1, 0]
  );
  const lanesOpacity = useTransform(scrollYProgress, [0.64, 0.78], [0, 1]);
  const labelsOpacity = useTransform(scrollYProgress, [0.7, 0.82], [0, 1]);
  // 3D tilt: board tilted in chaos, flat when ordered
  const containerRotX = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    [14, 6, 0, 0]
  );

  return (
    <section
      ref={containerRef}
      style={{ height: "300vh", background: "var(--bg)" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "var(--bg)",
        }}
      >
        {/* Subtle ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 60%, rgba(0,212,255,0.05) 0%, transparent 70%)",
          }}
        />

        {/* Section label */}
        <div className="relative z-10 mb-6 text-center">
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Como funciona
          </span>
        </div>

        {/* Headline — 3 phases stacked, opacity-driven */}
        <div className="relative z-10 mb-14" style={{ height: 52 }}>
          {[
            {
              opacity: h1Opacity,
              text: "Seu PI Planning hoje.",
              color: "var(--text-muted)",
              weight: 400,
            },
            {
              opacity: h2Opacity,
              text: "IA analisando dependências...",
              color: "var(--accent)",
              weight: 500,
            },
            {
              opacity: h3Opacity,
              text: "PI Planning organizado.",
              color: "var(--text)",
              weight: 700,
            },
          ].map(({ opacity, text, color, weight }) => (
            <motion.h2
              key={text}
              style={{
                opacity,
                position: "absolute",
                left: "50%",
                x: "-50%",
                whiteSpace: "nowrap",
                fontWeight: weight,
                fontSize: "clamp(1.6rem, 3.2vw, 2.4rem)",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                color,
              }}
            >
              {text}
            </motion.h2>
          ))}
        </div>

        {/* Cards area — perspective wrapper for 3D depth */}
        <div style={{ perspective: "1100px", width: "100%", maxWidth: 760 }}>
          <motion.div
            className="relative"
            style={{
              width: "100%",
              height: 280,
              overflow: "visible",
              rotateX: containerRotX,
              transformStyle: "preserve-3d",
            }}
          >
            {/* ART lane backgrounds (phase 3) */}
            <motion.div
              className="absolute inset-0"
              style={{ opacity: lanesOpacity }}
            >
              {ART_LANES.map((lane) => (
                <div
                  key={lane.label}
                  style={{
                    position: "absolute",
                    top: 20,
                    left: lane.left,
                    width: 180,
                    height: 240,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                />
              ))}
            </motion.div>

            {/* ART lane labels (phase 3) */}
            <motion.div
              className="absolute inset-0"
              style={{ opacity: labelsOpacity }}
            >
              {ART_LANES.map((lane) => (
                <div
                  key={lane.label}
                  style={{
                    position: "absolute",
                    top: 7,
                    left: lane.left,
                    width: 180,
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-faint)",
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {lane.label}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* Connection lines SVG (phase 2) */}
            <motion.svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: linesOpacity,
                pointerEvents: "none",
                overflow: "visible",
              }}
              viewBox="0 0 760 280"
            >
              {ANALYSIS_LINES.map((l, i) => (
                <line
                  key={i}
                  stroke={l.color}
                  strokeDasharray={l.dash ? "5,3" : "none"}
                  strokeLinecap="round"
                  strokeWidth={1.5}
                  x1={l.x1}
                  x2={l.x2}
                  y1={l.y1}
                  y2={l.y2}
                />
              ))}
            </motion.svg>

            {/* AI analysis badge (phase 2) */}
            <motion.div
              className="absolute z-20"
              style={{
                opacity: aiBadgeOpacity,
                top: "50%",
                left: "50%",
                x: "-50%",
                y: "-50%",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  background: "var(--accent-dim)",
                  border: "1px solid var(--border-accent)",
                  borderRadius: "var(--radius-full)",
                  padding: "6px 16px",
                  fontSize: 11,
                  color: "var(--accent)",
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                  boxShadow: "0 0 20px rgba(0,212,255,0.15)",
                }}
              >
                ⟢ IA detectando dependências cross-ART
              </div>
            </motion.div>

            {/* Feature cards */}
            {CARDS.map((card, i) => (
              <ChaosCard
                analyze={ANALYZE[i]}
                card={card}
                chaos={CHAOS[i]}
                key={card.name}
                ordered={ORDERED[i]}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
