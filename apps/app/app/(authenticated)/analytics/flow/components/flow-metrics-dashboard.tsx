"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import type { FlowMetricsResult, FlowScopeOption } from "@/app/actions/flow-metrics";
import type { AssessmentWithActions } from "@/app/actions/measure-grow";
import { COMPETENCIES } from "@/app/actions/measure-grow/constants";
import {
  createAssessment, createImprovementAction, updateActionStatus,
} from "@/app/actions/measure-grow";

const PRIMARY = "#5e6ad2";
const COLORS = ["#5e6ad2", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];
const STATUS_COLOR: Record<string, string> = {
  OPEN: "#f59e0b", IN_PROGRESS: "#5e6ad2", DONE: "#22c55e", CANCELLED: "#6b7280",
};
const METRIC_LABELS: Record<string, string> = {
  flow_velocity: "Flow Velocity",
  flow_time: "Flow Time",
  flow_load: "Flow Load",
  flow_efficiency: "Flow Efficiency",
  flow_predictability: "Flow Predictability",
  flow_distribution: "Flow Distribution",
};

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, trend, color = PRIMARY,
}: {
  label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#8a8f98";
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground">
          {trend && <span style={{ color: trendColor }}>{trendIcon} </span>}
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-1 w-4 rounded-full" style={{ background: PRIMARY }} />
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

type Props = {
  scopeOptions: FlowScopeOption[];
  selectedScope: { type: string; id: string } | null;
  metrics: FlowMetricsResult | null;
  assessments: AssessmentWithActions[];
  actions: { id: string; title: string; status: string; relatedMetric: string | null; dueDate: Date | null }[];
};

export function FlowMetricsDashboard({ scopeOptions, selectedScope, metrics, assessments, actions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"metrics" | "measure">("metrics");

  // Assessment form state
  const [assessCompetency, setAssessCompetency] = useState(COMPETENCIES[0].id);
  const [assessScore, setAssessScore] = useState(3);
  const [assessNotes, setAssessNotes] = useState("");
  const [assessLoading, setAssessLoading] = useState(false);

  // Action form state
  const [actionTitle, setActionTitle] = useState("");
  const [actionMetric, setActionMetric] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  function changeScope(type: string, id: string) {
    router.push(`/analytics/flow?scope=${type}&scopeId=${id}`);
  }

  async function submitAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScope) return;
    setAssessLoading(true);
    await createAssessment({
      scope: selectedScope.type,
      scopeId: selectedScope.id,
      competency: assessCompetency as never,
      score: assessScore,
      notes: assessNotes,
    });
    setAssessNotes("");
    setAssessLoading(false);
    router.refresh();
  }

  async function submitAction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScope || !actionTitle.trim()) return;
    setActionLoading(true);
    await createImprovementAction({
      title: actionTitle,
      scope: selectedScope.type,
      scopeId: selectedScope.id,
      relatedMetric: actionMetric || undefined,
    });
    setActionTitle("");
    setActionMetric("");
    setActionLoading(false);
    router.refresh();
  }

  // ── Scope selector ────────────────────────────────────────────────────────

  const scopeSelector = (
    <div className="flex flex-wrap gap-2 mb-6">
      {scopeOptions.map((opt) => (
        <button
          key={opt.id}
          onClick={() => changeScope(opt.type, opt.id)}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          style={
            selectedScope?.id === opt.id
              ? { background: PRIMARY, color: "#fff", borderColor: PRIMARY }
              : {}
          }
        >
          <span className="text-[10px] opacity-60 uppercase">{opt.type === "art" ? "ART" : "Time"}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (!metrics) {
    return (
      <div>
        {scopeSelector}
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Selecione um escopo para ver as métricas.
        </div>
      </div>
    );
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {scopeSelector}

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {(["metrics", "measure"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            style={
              activeTab === tab
                ? { borderColor: PRIMARY, color: PRIMARY }
                : { borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
            }
          >
            {tab === "metrics" ? "Flow Metrics" : "Measure & Grow"}
          </button>
        ))}
      </div>

      {/* ── FLOW METRICS TAB ─────────────────────────────────────────────── */}
      {activeTab === "metrics" && (
        <div className="space-y-8">
          {/* Decision-making alerts */}
          {(() => {
            const alerts: { level: "red" | "amber" | "green"; title: string; action: string }[] = [];
            if (metrics.flowLoad > 20)
              alerts.push({ level: "red",   title: `Flow Load alto (${metrics.flowLoad} itens em WIP)`, action: "Reduza WIP: finalize itens em andamento antes de puxar novos." });
            if (metrics.flowPredictability < 0.7)
              alerts.push({ level: "red",   title: `Predictability baixa (${Math.round(metrics.flowPredictability * 100)}%)`, action: "Revise capacidade vs. comprometimento e reduza o escopo do próximo PI." });
            else if (metrics.flowPredictability < 0.8)
              alerts.push({ level: "amber", title: `Predictability em risco (${Math.round(metrics.flowPredictability * 100)}%)`, action: "Identifique impedimentos e dependências não resolvidas." });
            if (metrics.flowEfficiency < 0.3)
              alerts.push({ level: "amber", title: `Eficiência de fluxo baixa (${Math.round(metrics.flowEfficiency * 100)}%)`, action: "Investigue filas de espera e handoffs entre times." });
            const lastVel = metrics.flowVelocity.at(-1)?.total ?? 0;
            const prevVel = metrics.flowVelocity.at(-2)?.total ?? 0;
            if (prevVel > 0 && lastVel < prevVel * 0.7)
              alerts.push({ level: "amber", title: `Queda de velocity (${prevVel} → ${lastVel})`, action: "Verifique impedimentos, ausências ou mudanças de escopo." });
            if (alerts.length === 0 && metrics.flowPredictability >= 0.8)
              alerts.push({ level: "green", title: "Fluxo saudável", action: "Predictability ≥80% e WIP dentro do limite. Continue monitorando tendências." });
            return alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div
                    key={a.title}
                    className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${
                      a.level === "red"   ? "border-red-300/50 bg-red-500/5" :
                      a.level === "amber" ? "border-amber-300/50 bg-amber-500/5" :
                                           "border-green-300/50 bg-green-500/5"
                    }`}
                  >
                    <span className={`text-base leading-none mt-0.5 ${a.level === "red" ? "text-red-500" : a.level === "amber" ? "text-amber-500" : "text-green-500"}`}>
                      {a.level === "green" ? "✓" : "⚠"}
                    </span>
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className={`text-xs mt-0.5 ${a.level === "red" ? "text-red-700 dark:text-red-400" : a.level === "amber" ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
                        → {a.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* KPI summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              label="Velocity"
              value={String(metrics.flowVelocity.at(-1)?.total ?? 0)}
              sub="itens/sprint"
              color="#5e6ad2"
            />
            <MetricCard
              label="Flow Time"
              value={`${metrics.flowTimeOverall}d`}
              sub="média end-to-end"
              color="#f59e0b"
            />
            <MetricCard
              label="Flow Load"
              value={String(metrics.flowLoad)}
              sub="itens em WIP"
              color={metrics.flowLoad > 20 ? "#ef4444" : "#22c55e"}
            />
            <MetricCard
              label="Efficiency"
              value={`${Math.round(metrics.flowEfficiency * 100)}%`}
              sub="tempo ativo/total"
              color="#8b5cf6"
            />
            <MetricCard
              label="Predictability"
              value={`${Math.round(metrics.flowPredictability * 100)}%`}
              sub="entregue/planejado"
              color={metrics.flowPredictability >= 0.8 ? "#22c55e" : "#f59e0b"}
            />
            <MetricCard
              label="Distribution"
              value={`${metrics.flowDistribution.length} tipos`}
              sub={metrics.flowDistribution.map((d) => `${d.type} ${d.pct}%`).join(" · ")}
              color="#06b6d4"
            />
          </div>

          {/* Charts row 1: Velocity + Distribution */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Flow Velocity */}
            <div className="rounded-xl border border-border bg-card p-4">
              <SectionTitle>Flow Velocity — itens por sprint</SectionTitle>
              {metrics.flowVelocity.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={metrics.flowVelocity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Sem sprints concluídos.</div>
              )}
            </div>

            {/* Flow Distribution */}
            <div className="rounded-xl border border-border bg-card p-4">
              <SectionTitle>Flow Distribution — mix de trabalho</SectionTitle>
              {metrics.flowDistribution.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={200}>
                    <PieChart>
                      <Pie
                        data={metrics.flowDistribution}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ type, pct }) => `${type} ${pct}%`}
                        labelLine={false}
                      >
                        {metrics.flowDistribution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {metrics.flowDistribution.map((d, i) => (
                      <div key={d.type} className="flex items-center gap-2 text-xs">
                        <div className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                        <span className="text-foreground font-medium">{d.type}</span>
                        <span className="text-muted-foreground">{d.count} ({d.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Sem itens concluídos no período.</div>
              )}
            </div>
          </div>

          {/* Charts row 2: Flow Time + Flow Load */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Flow Time */}
            <div className="rounded-xl border border-border bg-card p-4">
              <SectionTitle>Flow Time — ciclo médio por tipo (dias)</SectionTitle>
              {metrics.flowTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={metrics.flowTime} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="d" />
                    <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip formatter={(v: number) => [`${v}d`, "Média"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                      {metrics.flowTime.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Configure startedAt nos boards para calcular Flow Time real.
                </div>
              )}
            </div>

            {/* Flow Load / WIP */}
            <div className="rounded-xl border border-border bg-card p-4">
              <SectionTitle>Flow Load — WIP por sprint</SectionTitle>
              {metrics.flowLoadHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={metrics.flowLoadHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="wip" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    {/* Recommended WIP limit reference line */}
                    <Line type="monotone" data={metrics.flowLoadHistory.map((d) => ({ ...d, limit: 15 }))} dataKey="limit" stroke="#ef444460" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Sem histórico de sprints.</div>
              )}
            </div>
          </div>

          {/* Flow Predictability */}
          {metrics.flowPredictabilityHistory.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <SectionTitle>Flow Predictability — planejado vs entregue</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={metrics.flowPredictabilityHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="planned" name="Planejado" fill="#d1d5f8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Entregue" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── MEASURE & GROW TAB ───────────────────────────────────────────── */}
      {activeTab === "measure" && selectedScope && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: competency radar + history */}
          <div className="space-y-4">
            <SectionTitle>Competências SAFe — scores</SectionTitle>

            {/* Radar-style score bars */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {COMPETENCIES.map((c) => {
                const latest = assessments
                  .filter((a) => a.competency === c.id)
                  .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())[0];
                const score = latest?.score ?? null;
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{c.label}</span>
                      <span className="text-xs font-bold" style={{ color: score ? PRIMARY : "hsl(var(--muted-foreground))" }}>
                        {score ? `${score}/5` : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: score ? `${(score / 5) * 100}%` : "0%",
                          background: score
                            ? score >= 4 ? "#22c55e" : score >= 3 ? PRIMARY : "#f59e0b"
                            : PRIMARY,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* New Assessment form */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Novo Assessment</p>
              <form onSubmit={submitAssessment} className="space-y-3">
                <select
                  value={assessCompetency}
                  onChange={(e) => setAssessCompetency(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {COMPETENCIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-10">Score:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAssessScore(n)}
                        className="h-8 w-8 rounded-lg text-sm font-bold transition-colors"
                        style={
                          assessScore >= n
                            ? { background: PRIMARY, color: "#fff" }
                            : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder="Observações (opcional)"
                  value={assessNotes}
                  onChange={(e) => setAssessNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                />
                <button
                  type="submit"
                  disabled={assessLoading}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {assessLoading ? "Salvando…" : "Registrar assessment"}
                </button>
              </form>
            </div>
          </div>

          {/* Right: improvement actions */}
          <div className="space-y-4">
            <SectionTitle>Ações de Melhoria</SectionTitle>

            {/* Actions list */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {actions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ação registrada.</p>
              )}
              {actions.map((action) => (
                <div key={action.id} className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-start gap-3">
                  <div
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[action.status] ?? "#6b7280" }}
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-foreground">{action.title}</p>
                    {action.relatedMetric && (
                      <p className="text-[10px] text-muted-foreground">
                        Métrica: {METRIC_LABELS[action.relatedMetric] ?? action.relatedMetric}
                      </p>
                    )}
                  </div>
                  <select
                    value={action.status}
                    onChange={(e) => {
                      startTransition(() => updateActionStatus(action.id, e.target.value));
                    }}
                    className="text-[10px] rounded border border-border bg-background px-1 py-0.5"
                  >
                    {["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* New action form */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Nova Ação</p>
              <form onSubmit={submitAction} className="space-y-2">
                <input
                  type="text"
                  placeholder="Título da ação"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  required
                />
                <select
                  value={actionMetric}
                  onChange={(e) => setActionMetric(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Métrica relacionada (opcional)</option>
                  {Object.entries(METRIC_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={actionLoading || !actionTitle.trim()}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading ? "Salvando…" : "Registrar ação"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
