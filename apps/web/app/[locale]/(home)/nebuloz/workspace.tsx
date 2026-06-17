"use client";

import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import { useMemo, useState } from "react";

/* ── Shared spring configs ───────────────────────── */
const spring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 26,
  mass: 0.9,
};
const springBnc = {
  type: "spring" as const,
  stiffness: 520,
  damping: 20,
  mass: 0.75,
};
const stagger = { staggerChildren: 0.055, delayChildren: 0.06 };
const itemV = {
  hidden: { opacity: 0, y: 18, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring },
};

/* ── Nav items ───────────────────────────────────── */
const NAV = [
  { id: "runs", label: "Runs", count: "12" },
  { id: "sources", label: "Sources", count: "38" },
  { id: "policies", label: "Policies", count: "24" },
  { id: "connectors", label: "Connectors", count: "17" },
  { id: "telemetry", label: "Telemetry", count: "4.2k" },
];

/* ── Static data sets ────────────────────────────── */
const RUNS = [
  {
    id: "#2048",
    name: "access-audit-q3",
    status: "done",
    flags: 8,
    slug: "q3-pipeline-audit",
    title: "8 grants flagged · 3 require rotation",
    intent:
      "Surface all SaaS grants violating residency policy in the past 30 days.",
    context: "okta · workday · github · 1,284 docs",
    decision: "8 flagged · 3 rotate · 1 auto-revoked",
  },
  {
    id: "#2047",
    name: "q3-vendor-review",
    status: "done",
    flags: 2,
    slug: "q3-vendor-review",
    title: "2 vendor contracts expired · renewal required",
    intent:
      "Audit all third-party vendor contracts for Q3 expiry and compliance gaps.",
    context: "notion · workday · legal · 284 contracts",
    decision: "2 expired · 4 at-risk · 1 auto-renewed",
  },
  {
    id: "#2046",
    name: "gdpr-audit",
    status: "done",
    flags: 14,
    slug: "gdpr-compliance-q3",
    title: "14 data subjects flagged · 3 require deletion",
    intent:
      "Identify all EU data subject records exceeding retention under GDPR Art. 17.",
    context: "snowflake · okta · notion · 4,219 records",
    decision: "14 flagged · 3 delete · 7 anonymize",
  },
  {
    id: "#2045",
    name: "soc2-evidence",
    status: "running",
    flags: 0,
    slug: "soc2-type2-evidence",
    title: "Evidence collection in progress · 84%",
    intent:
      "Gather and attest all SOC 2 Type II evidence for the annual audit window.",
    context: "github · datadog · linear · 38,402 events",
    decision: "In progress · 42 controls verified · 8 pending",
  },
  {
    id: "#2044",
    name: "pii-scan-july",
    status: "done",
    flags: 6,
    slug: "pii-detection-july",
    title: "6 PII fields unmasked · masking applied",
    intent:
      "Scan all data pipelines for unmasked PII fields violating tokenization policy.",
    context: "snowflake · datadog · kafka · 142 TB scanned",
    decision: "6 unmasked · all tokenized · 2 alerted",
  },
];
const SOURCES = [
  {
    id: "okta",
    kind: "Identity",
    icon: "OKT",
    health: "ok",
    records: "12,841",
    lastSync: "2m",
  },
  {
    id: "workday",
    kind: "HR / Payroll",
    icon: "WRK",
    health: "ok",
    records: "4,219",
    lastSync: "5m",
  },
  {
    id: "github",
    kind: "Code",
    icon: "GH",
    health: "ok",
    records: "38,402",
    lastSync: "1m",
  },
  {
    id: "notion",
    kind: "Docs",
    icon: "NT",
    health: "warning",
    records: "8,122",
    lastSync: "18m",
  },
  {
    id: "snowflake",
    kind: "Warehouse",
    icon: "SF",
    health: "ok",
    records: "142 TB",
    lastSync: "1m",
  },
  {
    id: "datadog",
    kind: "Metrics",
    icon: "DD",
    health: "ok",
    records: "142,884",
    lastSync: "30s",
  },
  {
    id: "linear",
    kind: "Issues",
    icon: "LN",
    health: "ok",
    records: "284",
    lastSync: "3m",
  },
  {
    id: "slack",
    kind: "Comms",
    icon: "SL",
    health: "ok",
    records: "18,201",
    lastSync: "15s",
  },
];
const POLICIES = [
  {
    id: "access_residency",
    title: "Access residency",
    status: "active",
    violations: 8,
  },
  {
    id: "data_retention",
    title: "Data retention 30d",
    status: "active",
    violations: 0,
  },
  { id: "pii_masking", title: "PII masking", status: "warning", violations: 2 },
  { id: "model_scope", title: "Model scope", status: "active", violations: 0 },
  {
    id: "export_control",
    title: "Export control",
    status: "active",
    violations: 0,
  },
  {
    id: "rbac_enforce",
    title: "RBAC enforcement",
    status: "active",
    violations: 1,
  },
];
const POLICY_CODE: Record<string, string> = {
  access_residency:
    "rule access_residency {\n  when grant.region\n       ∉ workspace.allowed_regions\n  then flag\n     + notify(workspace.owner)\n}",
  data_retention:
    "rule data_retention_30d {\n  when record.age > 30d\n  then archive\n     + log(compliance.trail)\n}",
  pii_masking: `rule pii_masking {\n  when field.type == "pii"\n  then mask(\n    strategy: "tokenize"\n  )\n}`,
  model_scope:
    "rule model_scope {\n  when model ∉\n       workspace.allowed_models\n  then block\n     + alert(workspace.owner)\n}",
  export_control: `rule export_control {\n  when data.region == "EU"\n    && dest.region != "EU"\n  then block + flag\n}`,
  rbac_enforce:
    "rule rbac_enforce {\n  when action ∉\n       user.allowed_actions\n  then deny + audit_log()\n}",
};
const CONNECTORS = [
  {
    id: "okta-oidc",
    name: "Okta OIDC",
    type: "auth",
    reqs: "1,284",
    p95: "82ms",
    err: "0.0%",
    status: "ok",
  },
  {
    id: "workday-rest",
    name: "Workday REST",
    type: "hr",
    reqs: "442",
    p95: "312ms",
    err: "0.1%",
    status: "ok",
  },
  {
    id: "github-gql",
    name: "GitHub GraphQL",
    type: "code",
    reqs: "2,841",
    p95: "142ms",
    err: "0.0%",
    status: "ok",
  },
  {
    id: "notion-api",
    name: "Notion API",
    type: "docs",
    reqs: "184",
    p95: "418ms",
    err: "2.1%",
    status: "warn",
  },
  {
    id: "snowflake",
    name: "Snowflake SQL",
    type: "data",
    reqs: "84",
    p95: "1.2s",
    err: "0.0%",
    status: "ok",
  },
  {
    id: "datadog-api",
    name: "Datadog API",
    type: "obs",
    reqs: "12,841",
    p95: "48ms",
    err: "0.0%",
    status: "ok",
  },
];

/* ── Run graph with per-run topology ─────────────── */
const NW = 24,
  NH = 9; // node half-width / half-height (matches rect dims)

interface RunNode {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: string;
}
interface RunGraph {
  nodes: RunNode[];
  edges: [string, string][];
}

const RUN_GRAPHS: Record<string, RunGraph> = {
  "#2048": {
    nodes: [
      { id: "A", x: 28, y: 42, label: "okta", kind: "src" },
      { id: "B", x: 28, y: 80, label: "wrkd", kind: "src" },
      { id: "C", x: 28, y: 118, label: "gh", kind: "src" },
      { id: "D", x: 155, y: 80, label: "ctx", kind: "mid" },
      { id: "E", x: 272, y: 80, label: "policy", kind: "mid" },
      { id: "F", x: 380, y: 42, label: "flag", kind: "out" },
      { id: "G", x: 380, y: 80, label: "rotate", kind: "out" },
      { id: "H", x: 380, y: 118, label: "revoke", kind: "out" },
    ],
    edges: [
      ["A", "D"],
      ["B", "D"],
      ["C", "D"],
      ["D", "E"],
      ["E", "F"],
      ["E", "G"],
      ["E", "H"],
    ],
  },
  "#2047": {
    nodes: [
      { id: "A", x: 35, y: 55, label: "okta", kind: "src" },
      { id: "B", x: 35, y: 105, label: "sf", kind: "src" },
      { id: "C", x: 168, y: 80, label: "ctx", kind: "mid" },
      { id: "D", x: 290, y: 55, label: "check", kind: "mid" },
      { id: "E", x: 290, y: 105, label: "audit", kind: "mid" },
      { id: "F", x: 385, y: 55, label: "pass", kind: "out" },
      { id: "G", x: 385, y: 105, label: "flag", kind: "out" },
    ],
    edges: [
      ["A", "C"],
      ["B", "C"],
      ["C", "D"],
      ["C", "E"],
      ["D", "F"],
      ["E", "G"],
    ],
  },
  "#2046": {
    nodes: [
      { id: "A", x: 28, y: 25, label: "okta", kind: "src" },
      { id: "B", x: 28, y: 65, label: "wrkd", kind: "src" },
      { id: "C", x: 28, y: 105, label: "gh", kind: "src" },
      { id: "D", x: 28, y: 145, label: "drive", kind: "src" },
      { id: "E", x: 160, y: 85, label: "ctx", kind: "mid" },
      { id: "F", x: 272, y: 85, label: "gdpr", kind: "mid" },
      { id: "G", x: 382, y: 40, label: "ok", kind: "out" },
      { id: "H", x: 382, y: 85, label: "flag", kind: "out" },
      { id: "I", x: 382, y: 130, label: "alert", kind: "out" },
    ],
    edges: [
      ["A", "E"],
      ["B", "E"],
      ["C", "E"],
      ["D", "E"],
      ["E", "F"],
      ["F", "G"],
      ["F", "H"],
      ["F", "I"],
    ],
  },
  "#2045": {
    nodes: [
      { id: "A", x: 38, y: 50, label: "scan", kind: "src" },
      { id: "B", x: 38, y: 110, label: "collct", kind: "src" },
      { id: "C", x: 175, y: 80, label: "verify", kind: "mid" },
      { id: "D", x: 305, y: 80, label: "sign", kind: "mid" },
      { id: "E", x: 390, y: 50, label: "report", kind: "out" },
      { id: "F", x: 390, y: 110, label: "store", kind: "out" },
    ],
    edges: [
      ["A", "C"],
      ["B", "C"],
      ["C", "D"],
      ["D", "E"],
      ["D", "F"],
    ],
  },
  "#2044": {
    nodes: [
      { id: "A", x: 35, y: 52, label: "crawl", kind: "src" },
      { id: "B", x: 35, y: 108, label: "sample", kind: "src" },
      { id: "C", x: 168, y: 80, label: "detect", kind: "mid" },
      { id: "D", x: 285, y: 52, label: "mask", kind: "out" },
      { id: "E", x: 285, y: 108, label: "flag", kind: "out" },
      { id: "F", x: 385, y: 52, label: "store", kind: "out" },
      { id: "G", x: 385, y: 108, label: "alert", kind: "out" },
    ],
    edges: [
      ["A", "C"],
      ["B", "C"],
      ["C", "D"],
      ["C", "E"],
      ["D", "F"],
      ["E", "G"],
    ],
  },
};

export function RunGraph({
  inView,
  runId,
}: {
  inView: boolean;
  runId: string;
}) {
  const { nodes, edges } = RUN_GRAPHS[runId] || RUN_GRAPHS["#2048"];
  const find = (id: string) => nodes.find((n) => n.id === id);
  return (
    <svg className="block w-full" viewBox="0 0 420 165">
      <defs>
        <linearGradient id="rg" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--c-violet)" />
          <stop offset="50%" stopColor="var(--c-indigo)" />
          <stop offset="100%" stopColor="var(--c-cyan)" />
        </linearGradient>
      </defs>

      {/* Edges first — behind nodes */}
      {edges.map(([a, b], i) => {
        const A = find(a),
          B = find(b);
        if (!(A && B)) return null;
        const x1 = A.x + NW,
          y1 = A.y,
          x2 = B.x - NW,
          y2 = B.y,
          mx = (x1 + x2) / 2;
        const d = `M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}`;
        return (
          <motion.path
            animate={inView ? { pathLength: 1 } : {}}
            d={d}
            fill="none"
            initial={{ pathLength: 0 }}
            key={a + b}
            stroke="url(#rg)"
            strokeOpacity=".42"
            strokeWidth=".9"
            transition={{
              duration: 0.9,
              delay: 0.06 + i * 0.07,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        );
      })}

      {/* Nodes on top */}
      {nodes.map((n, i) => (
        <motion.g
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          initial={{ opacity: 0, scale: 0.5 }}
          key={n.id}
          transition={{ duration: 0.38, delay: 0.04 + i * 0.05 }}
        >
          <rect
            fill="rgba(10,13,22,0.9)"
            height={NH * 2}
            rx="3.5"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth=".8"
            width={NW * 2}
            x={n.x - NW}
            y={n.y - NH}
          />
          <text
            fill={
              n.kind === "out"
                ? "var(--c-cyan)"
                : n.kind === "mid"
                  ? "var(--c-violet)"
                  : "rgba(255,255,255,.62)"
            }
            fontFamily="JetBrains Mono"
            fontSize="8"
            textAnchor="middle"
            x={n.x}
            y={n.y + 3.5}
          >
            {n.label}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

/* ── Sparkline (right rail) ──────────────────────── */
export function Sparkline() {
  const pts = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => [
        i * (200 / 39),
        20 +
          Math.sin(i * 0.5) * 6 +
          Math.cos(i * 0.2) * 5 +
          (Math.random() * 4 - 2),
      ]),
    []
  );
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");
  return (
    <svg className="mb-3 w-full" viewBox="0 0 200 40">
      <defs>
        <linearGradient id="sp" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--c-violet)" stopOpacity=".55" />
          <stop offset="100%" stopColor="var(--c-violet)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + " L 200 40 L 0 40 Z"} fill="url(#sp)" />
      <path d={d} fill="none" stroke="var(--c-violet)" strokeWidth="1.4" />
    </svg>
  );
}

/* ── VIEW: Runs ──────────────────────────────────── */
function RunsView({ inView }: { inView: boolean }) {
  const [sel, setSel] = useState("#2048");
  return (
    <motion.div
      animate="visible"
      className="flex h-full gap-3"
      initial="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: stagger },
      }}
    >
      {/* Run list */}
      <motion.div
        className="flex w-[128px] shrink-0 flex-col gap-0.5"
        variants={itemV}
      >
        <div className="label mb-2 text-muted" style={{ fontSize: 9 }}>
          RECENT RUNS
        </div>
        {RUNS.map((r) => (
          <motion.button
            className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
              sel === r.id
                ? "bg-white/[0.07] text-ink"
                : "text-muted hover:text-body"
            }`}
            key={r.id}
            onClick={() => setSel(r.id)}
            transition={springBnc}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.93 }}
          >
            <div
              className="mb-0.5 text-muted"
              style={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
            >
              {r.id}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
            >
              {r.name.replace(/-/g, " ")}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`dot ${r.status === "running" ? "dot-cyan" : r.flags > 5 ? "dot-warning" : "dot-success"}`}
                style={{ width: 5, height: 5 }}
              />
              <span style={{ fontSize: 9, fontFamily: "JetBrains Mono" }}>
                {r.status === "running" ? "live" : `${r.flags} flags`}
              </span>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Run detail */}
      <motion.div
        className="flex min-w-0 flex-1 flex-col gap-2.5"
        variants={itemV}
      >
        <div className="ws-panel p-3">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              initial={{ opacity: 0, y: 6 }}
              key={sel}
              transition={spring}
            >
              <div className="mono mb-1 text-muted" style={{ fontSize: 9 }}>
                RUN · {sel} · {RUNS.find((r) => r.id === sel)?.slug}
              </div>
              <div className="display mb-3 text-[17px]">
                {RUNS.find((r) => r.id === sel)?.title}
              </div>
            </motion.div>
          </AnimatePresence>
          <RunGraph inView={inView} runId={sel} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 8 }}
            key={sel + "-cards"}
            transition={{ ...spring, delay: 0.05 }}
          >
            {[
              ["INTENT", RUNS.find((r) => r.id === sel)?.intent],
              ["CONTEXT", RUNS.find((r) => r.id === sel)?.context],
              ["DECISION", RUNS.find((r) => r.id === sel)?.decision],
            ].map(([t, v]) => (
              <div className="ws-panel p-2.5" key={t}>
                <div
                  className="label mb-1.5 text-muted"
                  style={{ fontSize: 9 }}
                >
                  {t}
                </div>
                <div
                  className="text-body leading-relaxed"
                  style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                >
                  {v}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ── VIEW: Sources ───────────────────────────────── */
function SourcesView() {
  return (
    <motion.div
      animate="visible"
      initial="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: stagger },
      }}
    >
      <div
        className="label mb-3 flex items-center gap-2 text-muted"
        style={{ fontSize: 9 }}
      >
        <span>CONNECTED SOURCES</span>
        <span className="text-white/20">·</span>
        <span className="text-body">{SOURCES.length} active</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SOURCES.map((s) => (
          <motion.div
            className="ws-panel group relative cursor-default overflow-hidden p-3"
            key={s.id}
            transition={spring}
            variants={itemV}
            whileHover={{ y: -2, scale: 1.015 }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(80% 80% at 50% 0%, rgba(124,108,255,0.09), transparent)",
              }}
            />
            <div className="mb-2.5 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] font-semibold text-body"
                  style={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
                >
                  {s.icon}
                </div>
                <div>
                  <div className="text-ink" style={{ fontSize: 11 }}>
                    {s.id}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
                  >
                    {s.kind}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <span
                  aria-hidden="true"
                  className={`dot ${s.health === "ok" ? "dot-success" : "dot-warning"}`}
                />
                <span className="sr-only">
                  {s.health === "ok" ? "Saudável" : "Atenção"}
                </span>
              </div>
            </div>
            <div
              className="flex items-center justify-between"
              style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
            >
              <span className="text-body">{s.records}</span>
              <span className="text-muted">↻ {s.lastSync}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── VIEW: Policies ──────────────────────────────── */
function PoliciesView() {
  const [sel, setSel] = useState("access_residency");
  const pol = POLICIES.find((p) => p.id === sel);
  return (
    <motion.div
      animate="visible"
      className="flex h-full gap-3"
      initial="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: stagger },
      }}
    >
      {/* Policy list */}
      <motion.div
        className="flex w-[140px] shrink-0 flex-col gap-0.5"
        variants={itemV}
      >
        <div className="label mb-2 text-muted" style={{ fontSize: 9 }}>
          POLICIES · {POLICIES.length}
        </div>
        {POLICIES.map((p) => (
          <motion.button
            className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
              sel === p.id
                ? "bg-white/[0.07] text-ink"
                : "text-muted hover:text-body"
            }`}
            key={p.id}
            onClick={() => setSel(p.id)}
            transition={springBnc}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.93 }}
          >
            <div className="mb-0.5 flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`dot ${p.status === "active" ? "dot-success" : "dot-warning"}`}
                style={{ width: 5, height: 5 }}
              />
              {p.violations > 0 && (
                <span className="text-warning" style={{ fontSize: 9 }}>
                  {p.violations}
                </span>
              )}
            </div>
            <div
              className="leading-tight"
              style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
            >
              {p.title}
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Policy code + detail */}
      <motion.div className="min-w-0 flex-1" variants={itemV}>
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="ws-panel flex h-full flex-col p-4"
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            key={sel}
            transition={spring}
          >
            <div
              className="label mb-1 flex items-center gap-2 text-muted"
              style={{ fontSize: 9 }}
            >
              <span
                aria-hidden="true"
                className={`dot ${pol?.status === "active" ? "dot-success" : "dot-warning"}`}
              />
              <span>{pol?.title.toUpperCase()}</span>
              {(pol?.violations ?? 0) > 0 && (
                <span className="text-warning">
                  {pol!.violations} violations
                </span>
              )}
            </div>
            <pre
              className="mt-2 flex-1 text-body leading-relaxed"
              style={{
                fontSize: 11,
                fontFamily: "JetBrains Mono",
                whiteSpace: "pre-wrap",
              }}
            >
              {POLICY_CODE[sel] || "// no code"}
            </pre>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ── VIEW: Connectors ────────────────────────────── */
function ConnectorsView() {
  return (
    <motion.div
      animate="visible"
      initial="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: stagger },
      }}
    >
      <div className="label mb-3 text-muted" style={{ fontSize: 9 }}>
        CONNECTOR HEALTH
      </div>
      <div className="ws-panel overflow-hidden">
        <div
          className="border-white/[0.05] border-b"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
            padding: "6px 12px",
            fontSize: 9,
            fontFamily: "JetBrains Mono",
            color: "var(--tw-text-opacity, rgba(107,116,138,1))",
          }}
        >
          {["NAME", "TYPE", "REQS/1H", "P95", "ERR%", "STATUS"].map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
        {CONNECTORS.map((c, i) => (
          <motion.div
            className="border-white/[0.03] border-b transition-colors"
            key={c.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
              padding: "9px 12px",
              fontSize: 11,
              fontFamily: "JetBrains Mono",
            }}
            variants={itemV}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.025)" }}
          >
            <div className="text-ink">{c.name}</div>
            <div
              className="text-muted"
              style={{ fontSize: 9, textTransform: "uppercase" }}
            >
              {c.type}
            </div>
            <div className="text-body">{c.reqs}</div>
            <div className="text-body">{c.p95}</div>
            <div className={c.err === "0.0%" ? "text-success" : "text-warning"}>
              {c.err}
            </div>
            <div>
              <span
                aria-hidden="true"
                className={`dot ${c.status === "ok" ? "dot-success" : "dot-warning"}`}
              />
              <span className="sr-only">
                {c.status === "ok" ? "Healthy" : "Warning"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── VIEW: Telemetry ─────────────────────────────── */
function TelemetryView() {
  const kpis = [
    { l: "Tokens / run", v: "142,884", d: "avg 30d" },
    { l: "P95 latency", v: "184ms", d: "all regions" },
    { l: "Cost / run", v: "$0.42", d: "blended" },
    { l: "Reqs / min", v: "284", d: "rolling 5m" },
  ];
  const pctls = [
    ["P50", "92ms"],
    ["P75", "148ms"],
    ["P90", "176ms"],
    ["P95", "184ms"],
    ["P99", "312ms"],
    ["MAX", "841ms"],
  ];
  const pts = useMemo(
    () =>
      Array.from({ length: 56 }).map((_, i) => [
        i * (340 / 55),
        30 +
          Math.sin(i * 0.4) * 8 +
          Math.cos(i * 0.17) * 6 +
          Math.random() * 5 -
          2.5,
      ]),
    []
  );
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");
  return (
    <motion.div
      animate="visible"
      className="flex h-full flex-col gap-3"
      initial="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: stagger },
      }}
    >
      <div className="grid grid-cols-4 gap-2">
        {kpis.map((m) => (
          <motion.div className="ws-panel p-3" key={m.l} variants={itemV}>
            <div className="label mb-1.5 text-muted" style={{ fontSize: 9 }}>
              {m.l}
            </div>
            <div className="display grad-text text-[17px]">{m.v}</div>
            <div
              className="mt-1 text-muted"
              style={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
            >
              {m.d}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div className="ws-panel flex-1 p-3" variants={itemV}>
        <div className="label mb-3 text-muted" style={{ fontSize: 9 }}>
          TOKEN USAGE · 56-POINT ROLLING
        </div>
        <svg className="w-full" viewBox="0 0 340 52">
          <defs>
            <linearGradient id="tele-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--c-violet)" stopOpacity=".45" />
              <stop offset="100%" stopColor="var(--c-violet)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            animate={{ opacity: 1 }}
            d={d + " L 340 52 L 0 52 Z"}
            fill="url(#tele-fill)"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
          <motion.path
            animate={{ pathLength: 1 }}
            d={d}
            fill="none"
            initial={{ pathLength: 0 }}
            stroke="var(--c-violet)"
            strokeWidth="1.5"
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {pctls.map(([p, v]) => (
            <div className="text-center" key={p}>
              <div
                className="mb-1 text-muted"
                style={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
              >
                {p}
              </div>
              <div
                className="text-ink"
                style={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Right rail ──────────────────────────────────── */
function ActivityRail() {
  return (
    <aside className="col-span-3 hidden border-white/5 border-l p-4 lg:block">
      <div className="label mb-2 text-muted" style={{ fontSize: 9 }}>
        TOKEN USAGE
      </div>
      <Sparkline />
      <div
        className="mb-5 grid grid-cols-2 gap-x-3 gap-y-2"
        style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
      >
        {[
          ["tokens", "142,884"],
          ["latency", "184ms"],
          ["cost", "$0.42"],
          ["policy", "strict"],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-muted">{k}</div>
            <div className="text-ink">{v}</div>
          </div>
        ))}
      </div>
      <div className="label mb-2 text-muted" style={{ fontSize: 9 }}>
        ACTIVITY
      </div>
      <div className="space-y-2.5">
        {[
          ["12s", "Maria R.", "approved decision"],
          ["1m", "Core", "queried okta"],
          ["3m", "Policy", "flagged 8 grants"],
          ["6m", "Jonas V.", "started run"],
        ].map(([t, w, a], i) => (
          <div
            className="flex items-start gap-2"
            key={i}
            style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
          >
            <span className="w-7 shrink-0 text-faint">{t}</span>
            <span className="text-body">
              <span className="text-ink">{w}</span> {a}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ── WorkspaceShell — main export ────────────────── */
const VIEWS: Record<string, React.ComponentType<{ inView: boolean }>> = {
  runs: RunsView,
  sources: SourcesView as React.ComponentType<{ inView: boolean }>,
  policies: PoliciesView as React.ComponentType<{ inView: boolean }>,
  connectors: ConnectorsView as React.ComponentType<{ inView: boolean }>,
  telemetry: TelemetryView as React.ComponentType<{ inView: boolean }>,
};

export function WorkspaceShell({ inView }: { inView: boolean }) {
  const [active, setActive] = useState("runs");
  const View = VIEWS[active] || RunsView;

  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0a0d16]">
      {/* Chrome bar */}
      <div className="flex h-10 items-center gap-3 border-white/5 border-b bg-white/[0.015] px-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <div
          className="ml-3 flex items-center gap-2 text-muted"
          style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
        >
          <span>nebuloz</span>
          <span className="text-white/20">/</span>
          <span>strata</span>
          <span className="text-white/20">/</span>
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="text-body"
            initial={{ opacity: 0, y: 5 }}
            key={active}
            style={{ display: "inline-block" }}
            transition={spring}
          >
            {active}
          </motion.span>
        </div>
        <div
          className="ml-auto flex items-center gap-2 text-muted"
          style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
        >
          <span aria-hidden="true" className="dot dot-success" />
          <span>healthy</span>
        </div>
      </div>

      <div className="grid grid-cols-12">
        {/* Sidebar */}
        <aside className="col-span-3 min-h-[420px] border-white/5 border-r p-3 lg:col-span-2">
          <div className="label mb-2 px-2 text-muted" style={{ fontSize: 9 }}>
            WORKSPACE
          </div>
          <div className="space-y-0.5">
            {NAV.map((item) => (
              <motion.button
                className={`relative flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition-colors ${
                  active === item.id
                    ? "bg-white/[0.05] text-ink"
                    : "text-body hover:text-ink"
                }`}
                key={item.id}
                onClick={() => setActive(item.id)}
                style={{ fontSize: 12 }}
                transition={springBnc}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.93 }}
              >
                {active === item.id && (
                  <motion.div
                    className="absolute inset-y-0.5 left-0 w-0.5 rounded-r"
                    layoutId="nav-indicator"
                    style={{
                      background:
                        "linear-gradient(to bottom, var(--c-violet), var(--c-cyan))",
                    }}
                    transition={spring}
                  />
                )}
                <span className="pl-1">{item.label}</span>
                <span
                  className="text-muted"
                  style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                >
                  {item.count}
                </span>
              </motion.button>
            ))}
          </div>

          <div
            className="label mt-5 mb-2 px-2 text-muted"
            style={{ fontSize: 9 }}
          >
            TEAM
          </div>
          <div className="space-y-1">
            {[
              ["MR", "#7c6cff", "Maria R."],
              ["JV", "#5b8cff", "Jonas V."],
              ["CM", "#3cc3ff", "Chen M."],
              ["+3", null, "3 more"],
            ].map(([ini, c, n], idx) => (
              <div
                className="flex min-w-0 items-center gap-2 px-2 py-1 text-body"
                key={idx}
                style={{ fontSize: 12 }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-medium"
                  style={{
                    background: c || "rgba(255,255,255,0.06)",
                    color: c ? "#0a0d16" : "#b8c0d0",
                    fontSize: 9,
                    fontFamily: "JetBrains Mono",
                  }}
                >
                  {ini}
                </span>
                <span className="truncate opacity-70">{n}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main view with spring transitions */}
        <main className="col-span-9 min-h-[420px] overflow-hidden p-4 md:p-5 lg:col-span-7">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, x: 0, scale: 1 }}
              className="h-full"
              exit={{ opacity: 0, x: -20, scale: 0.97 }}
              initial={{ opacity: 0, x: 28, scale: 0.97 }}
              key={active}
              transition={{
                type: "spring" as const,
                stiffness: 360,
                damping: 28,
                mass: 0.88,
              }}
            >
              <View inView={inView} />
            </motion.div>
          </AnimatePresence>
        </main>

        <ActivityRail />
      </div>
    </div>
  );
}
