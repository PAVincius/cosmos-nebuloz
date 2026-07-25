"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { usePalette } from "./contexts";

/* ────────────────────────────────────────────────
   NODE MAP
   Layout: three vertical lanes on a 760×560 viewbox.
   Inputs (x≈80), Orbit/Core (x≈260–380), Outputs (x≈680).
   policy & metric are offset left of core so their edges curve properly.
   ──────────────────────────────────────────────── */
interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  k: string;
  desc: string;
}

const NODES: NodeDef[] = [
  {
    id: "sources",
    label: "Sources",
    x: 78,
    y: 130,
    k: "edge",
    desc: "Connectors to data warehouses, repos, docs, and SaaS surfaces.",
  },
  {
    id: "context",
    label: "Context",
    x: 78,
    y: 280,
    k: "edge",
    desc: "Embedded retrieval and semantic indexing per workspace.",
  },
  {
    id: "identity",
    label: "Identity",
    x: 78,
    y: 430,
    k: "edge",
    desc: "SSO, RBAC, scoped credentials. Every action is attributable.",
  },

  {
    id: "policy",
    label: "Policy",
    x: 240,
    y: 110,
    k: "orbit",
    desc: "Declarative governance: who, what, where, when.",
  },
  {
    id: "metric",
    label: "Telemetry",
    x: 240,
    y: 450,
    k: "orbit",
    desc: "Every signal logged, replayable, auditable.",
  },

  {
    id: "core",
    label: "Core",
    x: 380,
    y: 280,
    k: "core",
    desc: "The orchestrator. Routes intent, applies policy, composes models.",
  },

  {
    id: "planner",
    label: "Planner",
    x: 682,
    y: 130,
    k: "out",
    desc: "Decomposes goals into a supervised DAG of typed tasks.",
  },
  {
    id: "actions",
    label: "Actions",
    x: 682,
    y: 280,
    k: "out",
    desc: "Typed tool-calls into your systems. Diffs before commit.",
  },
  {
    id: "surface",
    label: "Surface",
    x: 682,
    y: 430,
    k: "out",
    desc: "The workspace your team reads and governs from.",
  },
];

const EDGES: [string, string][] = [
  ["sources", "core"],
  ["context", "core"],
  ["identity", "core"],
  ["policy", "core"],
  ["metric", "core"],
  ["core", "planner"],
  ["core", "actions"],
  ["core", "surface"],
];

/* Cubic bezier S-curve between any two points */
function sCurve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

export function SystemDiagram() {
  const [active, setActive] = useState("core");
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-12%" });
  const palette = usePalette();

  const activeNode = NODES.find((n) => n.id === active) || NODES[5];

  return (
    <section className="relative py-28 md:py-36" id="system" ref={sectionRef}>
      <div className="mx-auto max-w-[1280px] px-6">
        {/* header */}
        <div className="mb-12 grid gap-8 md:grid-cols-12">
          <div className="md:col-span-6">
            <div className="label mb-4 flex items-center gap-2 text-muted">
              <span aria-hidden="true" className="dot dot-violet" />
              <span>SECTION · 03 / SYSTEM</span>
            </div>
            <h2 className="display display-tight text-[clamp(38px,4.8vw,68px)]">
              <span className="grad-text">One core.</span>
              <br />
              <span className="accent-text">Nine governed surfaces.</span>
            </h2>
          </div>
          <div className="self-end md:col-span-6">
            <p className="max-w-md text-[16px] text-body leading-[1.6]">
              Nebuloz isn&apos;t a chatbot bolted onto your stack — it&apos;s a
              graph. Sources feed context, identity gates intent, policy shapes
              action, and every signal lands in telemetry. Hover any node to
              inspect its role.
            </p>
          </div>
        </div>

        {/* diagram card */}
        <div className="card overflow-hidden">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(50% 60% at 50% 50%, ${palette[0]}18 0%, transparent 70%)`,
              }}
            />
          </div>

          <div className="relative grid gap-0 md:grid-cols-12">
            {/* SVG diagram */}
            <div className="border-white/[0.06] border-b p-4 md:col-span-8 md:border-r md:border-b-0 md:p-6">
              <DiagramSVG
                active={active}
                inView={inView}
                palette={palette}
                setActive={setActive}
              />
            </div>

            {/* inspector panel */}
            <div className="flex flex-col gap-0 p-6 md:col-span-4">
              <div className="label mb-4 text-muted">INSPECTOR</div>

              <AnimatePresence mode="wait">
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  initial={{ opacity: 0, y: 8 }}
                  key={active}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`dot ${
                        activeNode.k === "core"
                          ? "dot-violet"
                          : activeNode.k === "out"
                            ? "dot-success"
                            : "dot-cyan"
                      }`}
                    />
                    <span className="label text-muted">
                      {activeNode.k.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="display mb-3 text-[32px]">
                    {activeNode.label}
                  </h3>
                  <p className="mb-6 text-[14px] text-body leading-[1.6]">
                    {activeNode.desc}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-auto border-white/[0.06] border-t pt-5">
                <div className="label mb-3 text-muted">EDGES FROM/TO</div>
                <div className="space-y-1.5">
                  {EDGES.filter(([a, b]) => a === active || b === active).map(
                    ([a, b]) => (
                      <div
                        className="mono flex items-center gap-2 text-[12px]"
                        key={a + b}
                      >
                        <span
                          className={a === active ? "text-ink" : "text-muted"}
                        >
                          {a}
                        </span>
                        <svg
                          className="text-muted"
                          height="6"
                          viewBox="0 0 18 6"
                          width="18"
                        >
                          <path
                            d="M0 3h15m-4-2.5l4 2.5-4 2.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                          />
                        </svg>
                        <span
                          className={b === active ? "text-ink" : "text-muted"}
                        >
                          {b}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* node picker bar */}
              <div className="mt-5 border-white/[0.06] border-t pt-5">
                <div className="label mb-2 text-muted">NODES</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {NODES.map((n) => (
                    <button
                      className={`mono text-[11px] uppercase tracking-wide transition-colors ${active === n.id ? "text-ink" : "text-muted hover:text-body"}`}
                      key={n.id}
                      onMouseEnter={() => setActive(n.id)}
                    >
                      {n.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface DiagramSVGProps {
  active: string;
  setActive: (id: string) => void;
  inView: boolean;
  palette: string[];
}

function DiagramSVG({ active, setActive, inView, palette }: DiagramSVGProps) {
  const find = (id: string) => NODES.find((n) => n.id === id);

  return (
    <svg
      aria-label="Nebuloz system graph"
      className="block h-auto w-full"
      viewBox="0 0 760 560"
    >
      <defs>
        {/* gradient along x-axis */}
        <linearGradient id="nz-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={palette[0]} />
          <stop offset="50%" stopColor={palette[1]} />
          <stop offset="100%" stopColor={palette[2]} />
        </linearGradient>
        {/* glow filter */}
        <filter height="220%" id="node-glow" width="220%" x="-60%" y="-60%">
          <feGaussianBlur result="b" stdDeviation="5" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle dot grid */}
      <pattern
        height="40"
        id="grid"
        patternUnits="userSpaceOnUse"
        width="40"
        x="0"
        y="0"
      >
        <circle cx="0.5" cy="0.5" fill="rgba(255,255,255,0.07)" r="0.5" />
      </pattern>
      <rect fill="url(#grid)" height="560" width="760" />

      {/* Lane labels */}
      <g
        fill="rgba(255,255,255,0.28)"
        fontFamily="JetBrains Mono"
        fontSize="9"
        letterSpacing="0.08em"
      >
        <text x="24" y="30">
          INPUTS
        </text>
        <text x="310" y="30">
          GOVERNANCE
        </text>
        <text x="635" y="30">
          OUTPUTS
        </text>
        <line
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          x1="20"
          x2="160"
          y1="40"
          y2="40"
        />
        <line
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          x1="290"
          x2="440"
          y1="40"
          y2="40"
        />
        <line
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          x1="620"
          x2="750"
          y1="40"
          y2="40"
        />
      </g>

      {/* Core ambient glow */}
      <radialGradient cx="0.5" cy="0.5" id="core-glow" r="0.5">
        <stop offset="0%" stopColor={palette[0]} stopOpacity="0.28" />
        <stop offset="100%" stopColor={palette[0]} stopOpacity="0" />
      </radialGradient>
      <ellipse cx="380" cy="280" fill="url(#core-glow)" rx="160" ry="140" />

      {/* ── EDGES ── */}
      {EDGES.map(([a, b], i) => {
        const A = find(a),
          B = find(b);
        if (!(A && B)) return null;
        const d = sCurve(A, B);
        const isActive = active === a || active === b;
        return (
          <g key={a + b}>
            {/* base track */}
            <motion.path
              animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
              d={d}
              fill="none"
              initial={{ pathLength: 0 }}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              transition={{
                duration: 1.6,
                delay: 0.1 + i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
            {/* active / accent track */}
            <motion.path
              animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
              d={d}
              fill="none"
              initial={{ pathLength: 0 }}
              stroke="url(#nz-grad)"
              strokeOpacity={isActive ? 1 : 0.35}
              strokeWidth={isActive ? 1.8 : 0.8}
              transition={{
                duration: 1.4,
                delay: 0.2 + i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
            {/* flowing data particle when active */}
            {isActive && inView && (
              <circle
                fill="white"
                r="3"
                style={{ filter: "drop-shadow(0 0 5px #fff)" }}
              >
                <animateMotion dur="1.8s" path={d} repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}

      {/* ── NODES ── */}
      {NODES.map((n, i) => (
        <DiagramNode
          active={active === n.id}
          delay={0.3 + i * 0.07}
          inView={inView}
          key={n.id}
          node={n}
          onHover={setActive}
          palette={palette}
        />
      ))}
    </svg>
  );
}

interface DiagramNodeProps {
  node: NodeDef;
  active: boolean;
  delay: number;
  inView: boolean;
  onHover: (id: string) => void;
  palette: string[];
}

function DiagramNode({
  node,
  active,
  delay,
  inView,
  onHover,
  palette,
}: DiagramNodeProps) {
  const isCore = node.k === "core";
  const r = isCore ? 36 : node.k === "orbit" ? 22 : 24;

  const fillColor = isCore ? "#08090e" : "#0b0e18";
  const strokeActive = "url(#nz-grad)";
  const strokeIdle = "rgba(255,255,255,0.20)";

  return (
    <motion.g
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
      aria-label={node.label}
      initial={{ opacity: 0, scale: 0.5 }}
      onFocus={() => onHover(node.id)}
      onMouseEnter={() => onHover(node.id)}
      role="button"
      style={{ cursor: "pointer", outline: "none" }}
      tabIndex={0}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* pulse ring when active */}
      {active && (
        <motion.circle
          animate={{ scale: [1, 1.22, 1], opacity: [0.4, 0.1, 0.4] }}
          cx={node.x}
          cy={node.y}
          fill="none"
          r={r + 18}
          stroke={palette[0]}
          strokeOpacity="0.4"
          strokeWidth="1"
          style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          transition={{
            duration: 2.4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      )}

      {/* node body */}
      <circle
        cx={node.x}
        cy={node.y}
        fill={fillColor}
        filter={active ? "url(#node-glow)" : undefined}
        r={r}
        stroke={active ? strokeActive : strokeIdle}
        strokeWidth={active ? 1.6 : 1}
      />

      {/* inner icon by kind */}
      {isCore && (
        <CoreIcon active={active} palette={palette} x={node.x} y={node.y} />
      )}
      {node.k === "edge" && <EdgeIcon active={active} x={node.x} y={node.y} />}
      {node.k === "orbit" && (
        <OrbitIcon active={active} x={node.x} y={node.y} />
      )}
      {node.k === "out" && <OutIcon active={active} x={node.x} y={node.y} />}

      {/* label */}
      <text
        fill={active ? "#f5f7fb" : "rgba(255,255,255,0.42)"}
        fontFamily="JetBrains Mono"
        fontSize="10"
        letterSpacing="0.07em"
        textAnchor="middle"
        x={node.x}
        y={node.y + r + 16}
      >
        {node.label.toUpperCase()}
      </text>
    </motion.g>
  );
}

function CoreIcon({
  x,
  y,
  active,
  palette,
}: {
  x: number;
  y: number;
  active: boolean;
  palette: string[];
}) {
  return (
    <g>
      <motion.g
        animate={{ rotate: 360 }}
        style={{ transformOrigin: `${x}px ${y}px` }}
        transition={{
          duration: 20,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <circle
          cx={x}
          cy={y}
          fill="none"
          r="18"
          stroke="url(#nz-grad)"
          strokeDasharray="3 5"
          strokeWidth="0.8"
        />
      </motion.g>
      <motion.g
        animate={{ rotate: -360 }}
        style={{ transformOrigin: `${x}px ${y}px` }}
        transition={{
          duration: 30,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <circle
          cx={x}
          cy={y}
          fill="none"
          r="10"
          stroke="url(#nz-grad)"
          strokeDasharray="2 3"
          strokeWidth="0.6"
        />
      </motion.g>
      <circle
        cx={x}
        cy={y}
        fill="url(#nz-grad)"
        opacity={active ? 1 : 0.65}
        r="5"
      />
    </g>
  );
}

function EdgeIcon({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? "url(#nz-grad)" : "rgba(255,255,255,0.45)";
  return (
    <g fill="none" stroke={c} strokeLinecap="round" strokeWidth="1.2">
      <rect height="16" rx="2.5" stroke={c} width="16" x={x - 8} y={y - 8} />
      <line x1={x - 4} x2={x + 4} y1={y - 2} y2={y - 2} />
      <line x1={x - 4} x2={x + 1} y1={y + 2} y2={y + 2} />
      <line x1={x - 4} x2={x + 4} y1={y + 6} y2={y + 6} />
    </g>
  );
}

function OrbitIcon({
  x,
  y,
  active,
}: {
  x: number;
  y: number;
  active: boolean;
}) {
  const c = active ? "url(#nz-grad)" : "rgba(255,255,255,0.45)";
  return (
    <g>
      <circle cx={x} cy={y} fill="none" r="9" stroke={c} strokeWidth="1.2" />
      <circle
        cx={x}
        cy={y}
        fill={active ? "url(#nz-grad)" : "rgba(255,255,255,0.45)"}
        r="3"
      />
    </g>
  );
}

function OutIcon({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? "url(#nz-grad)" : "rgba(255,255,255,0.45)";
  return (
    <g
      fill="none"
      stroke={c}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
    >
      <polygon
        points={`${x},${y - 10} ${x + 9},${y + 6} ${x - 9},${y + 6}`}
        stroke={c}
      />
    </g>
  );
}
