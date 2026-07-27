"use client";

import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

const STORAGE_KEY = "cosmos_walkthrough_v1_seen";

// ── Slide mock UIs ──────────────────────────────────────────────────────────

function MockKanban() {
  const cols = [
    {
      label: "Funnel",
      color: "#5e6ad2",
      items: ["Migração Cloud", "API Gateway"],
    },
    { label: "Analisando", color: "#f59e0b", items: ["Auth v2"] },
    {
      label: "Em construção",
      color: "#3b82f6",
      items: ["Dashboard BI", "Relatórios"],
    },
    { label: "Validando", color: "#8b5cf6", items: ["Mobile App"] },
    { label: "Entregue", color: "#22c55e", items: ["Login SSO"] },
  ];
  return (
    <div className="flex gap-2 overflow-hidden rounded-lg">
      {cols.map((col) => (
        <div
          className="min-w-0 flex-1 space-y-1.5 rounded-lg bg-muted/60 p-2"
          key={col.label}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: col.color }}
            />
            <span className="truncate font-semibold text-[9px] text-muted-foreground uppercase tracking-wider">
              {col.label}
            </span>
          </div>
          {col.items.map((item) => (
            <div
              className="rounded-md border border-border/50 bg-card px-2 py-1.5 font-medium text-[9px] text-foreground shadow-sm"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MockPIPlanning() {
  const teams = ["Squad Alpha", "Squad Beta", "Squad Gamma"];
  const iterations = ["IP", "IT 1", "IT 2", "IT 3", "IT 4", "IT 5"];
  return (
    <div className="overflow-hidden rounded-lg border border-border/50">
      <div
        className="grid text-[8px]"
        style={{ gridTemplateColumns: "72px repeat(6, 1fr)" }}
      >
        <div className="bg-muted/80 p-1.5 font-semibold text-muted-foreground" />
        {iterations.map((it) => (
          <div
            className="border-border/30 border-l bg-[#5e6ad2]/10 p-1.5 text-center font-bold text-[#5e6ad2]"
            key={it}
          >
            {it}
          </div>
        ))}
        {teams.map((team, ti) => (
          <Fragment key={ti}>
            <div
              className="border-border/30 border-t bg-muted/40 p-1.5 font-semibold text-[8px] text-foreground"
              key={team}
            >
              {team}
            </div>
            {iterations.map((_, ii) => (
              <div
                className="border-border/30 border-t border-l bg-background/50 p-1"
                key={ii}
              >
                {Math.random() > 0.5 && (
                  <div className="truncate rounded bg-[#5e6ad2]/20 px-1 py-0.5 font-medium text-[#5e6ad2] text-[7px]">
                    {
                      ["Auth", "API", "UI", "DB", "ETL"][
                        Math.floor(Math.random() * 5)
                      ]
                    }
                  </div>
                )}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function MockDependencies() {
  return (
    <div className="relative h-36 overflow-hidden rounded-lg border border-border/50 bg-muted/30">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 144">
        <defs>
          <marker
            id="arrow"
            markerHeight="6"
            markerWidth="6"
            orient="auto"
            refX="9"
            refY="5"
            viewBox="0 0 10 10"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#5e6ad2" />
          </marker>
        </defs>
        {/* Lines */}
        <line
          markerEnd="url(#arrow)"
          stroke="#5e6ad2"
          strokeDasharray="4 2"
          strokeWidth="1.5"
          x1="80"
          x2="160"
          y1="40"
          y2="72"
        />
        <line
          markerEnd="url(#arrow)"
          stroke="#f59e0b"
          strokeDasharray="4 2"
          strokeWidth="1.5"
          x1="80"
          x2="160"
          y1="104"
          y2="72"
        />
        <line
          markerEnd="url(#arrow)"
          stroke="#22c55e"
          strokeWidth="1.5"
          x1="160"
          x2="240"
          y1="72"
          y2="40"
        />
        <line
          markerEnd="url(#arrow)"
          stroke="#5e6ad2"
          strokeWidth="1.5"
          x1="160"
          x2="240"
          y1="72"
          y2="104"
        />
        {/* Nodes */}
        {[
          { x: 40, y: 30, label: "Auth v2", color: "#5e6ad2" },
          { x: 40, y: 94, label: "API GW", color: "#f59e0b" },
          { x: 140, y: 62, label: "Gateway", color: "#8b5cf6" },
          { x: 210, y: 30, label: "Mobile", color: "#22c55e" },
          { x: 210, y: 94, label: "Portal", color: "#5e6ad2" },
        ].map(({ x, y, label, color }) => (
          <g key={label}>
            <rect
              fill={`${color}20`}
              height="22"
              rx="5"
              stroke={color}
              strokeWidth="1"
              width="56"
              x={x}
              y={y}
            />
            <text
              fill={color}
              fontSize="7"
              fontWeight="600"
              textAnchor="middle"
              x={x + 28}
              y={y + 15}
            >
              {label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MockOKR() {
  return (
    <div className="space-y-2">
      {[
        {
          theme: "Acelerar time-to-market",
          color: "#5e6ad2",
          okr: "Reduzir lead time 40%",
          progress: 65,
        },
        {
          theme: "Experiência do cliente",
          color: "#f59e0b",
          okr: "NPS ≥ 70 até Q4",
          progress: 42,
        },
        {
          theme: "Escalabilidade",
          color: "#22c55e",
          okr: "99.9% uptime",
          progress: 88,
        },
      ].map(({ theme, color, okr, progress }) => (
        <div
          className="space-y-1.5 rounded-lg border border-border/50 bg-card p-2.5"
          key={theme}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            <span className="font-bold text-[9px] text-foreground">
              {theme}
            </span>
          </div>
          <div className="pl-3.5 text-[8px] text-muted-foreground">{okr}</div>
          <div className="pl-3.5">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: color }}
              />
            </div>
            <span className="text-[7px] text-muted-foreground">
              {progress}% concluído
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockRisks() {
  const risks = [
    { title: "Dependência externa crítica", severity: "HIGH", label: "Alta" },
    {
      title: "Capacidade insuficiente no IT3",
      severity: "MED",
      label: "Média",
    },
    { title: "Integração legada pendente", severity: "LOW", label: "Baixa" },
  ];
  const colors: Record<string, string> = {
    HIGH: "#ef4444",
    MED: "#f59e0b",
    LOW: "#22c55e",
  };
  return (
    <div className="space-y-2">
      {risks.map(({ title, severity, label }) => (
        <div
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2"
          key={title}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-[8px] text-white"
            style={{ background: colors[severity] }}
          >
            {severity[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[9px] text-foreground">
              {title}
            </p>
            <p className="text-[7px]" style={{ color: colors[severity] }}>
              Severidade {label}
            </p>
          </div>
          <div
            className="shrink-0 rounded px-1.5 py-0.5 font-bold text-[7px]"
            style={{
              background: `${colors[severity]}20`,
              color: colors[severity],
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Slides definition ────────────────────────────────────────────────────────

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  hotspot: string;
  mock: React.ReactNode;
  badge?: string;
};

const SLIDES: Slide[] = [
  {
    id: "kanban",
    title: "Portfolio Kanban",
    subtitle: "Seu hub central de épicos SAFe",
    description:
      "Arraste épicos entre os estágios do ciclo SAFe. Todas as alterações sincronizam em tempo real para todo o workspace.",
    hotspot: "🖱️ Arraste um card para mover o épico de estágio",
    mock: <MockKanban />,
    badge: "Você está aqui",
  },
  {
    id: "pi-planning",
    title: "PI Planning",
    subtitle: "Planejamento de incremento colaborativo",
    description:
      "Distribua features entre iterações e times em um board visual. Identifique conflitos de capacidade antes do PI começar.",
    hotspot: "📌 Clique em uma célula para adicionar uma feature à iteração",
    mock: <MockPIPlanning />,
  },
  {
    id: "dependencies",
    title: "Mapa de Dependências",
    subtitle: "Visualize bloqueios entre times",
    description:
      "Conecte épicos e features com linhas de dependência. O Cosmos destaca automaticamente caminhos críticos e riscos de bloqueio.",
    hotspot: "🔗 Arraste de um nó para outro para criar uma dependência",
    mock: <MockDependencies />,
  },
  {
    id: "okr",
    title: "OKRs e Temas Estratégicos",
    subtitle: "Alinhe execução à estratégia",
    description:
      "Vincule épicos a temas estratégicos e acompanhe o progresso de OKRs em tempo real. Garanta que cada entrega gere valor de negócio.",
    hotspot: "🎯 Clique em 'Vincular épico' para conectar entrega à estratégia",
    mock: <MockOKR />,
  },
  {
    id: "risks",
    title: "Gestão de Riscos",
    subtitle: "IA detecta impedimentos antes de acontecerem",
    description:
      "O modelo de IA analisa padrões históricos e sinaliza riscos potenciais com antecedência. Resolva impedimentos no momento certo.",
    hotspot: "⚠️ Clique em um risco para registrar o plano de mitigação",
    mock: <MockRisks />,
  },
];

// ── Main modal ───────────────────────────────────────────────────────────────

export function WalkthroughModal() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  const slide = SLIDES[current];
  const isFirst = current === 0;
  const isLast = current === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* Top accent bar */}
        <div
          className="h-[3px] w-full"
          style={{
            background:
              "linear-gradient(90deg, #5e6ad2 0%, #828fff 60%, #5e6ad2 100%)",
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#5e6ad2]">◆</span>
            <span className="font-semibold text-muted-foreground text-sm">
              Tour do Cosmos
            </span>
            {slide.badge && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-[10px] text-primary">
                {slide.badge}
              </span>
            )}
          </div>
          <button
            aria-label="Fechar tour"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={dismiss}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-6 pt-3">
          {SLIDES.map((s, i) => (
            <button
              aria-label={`Slide ${i + 1}`}
              className="rounded-full transition-all duration-300"
              key={s.id}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                background:
                  i === current
                    ? "#5e6ad2"
                    : i < current
                      ? "#5e6ad2aa"
                      : "hsl(var(--border))",
              }}
            />
          ))}
          <span className="ml-auto text-muted-foreground text-xs">
            {current + 1} / {SLIDES.length}
          </span>
        </div>

        {/* Content */}
        <div className="grid grid-cols-2 gap-6 px-6 pt-4 pb-2">
          {/* Left: text */}
          <div className="flex flex-col justify-center space-y-3">
            <div>
              <p className="font-semibold text-primary text-xs uppercase tracking-widest">
                {slide.subtitle}
              </p>
              <h2 className="mt-1 font-bold text-foreground text-xl tracking-tight">
                {slide.title}
              </h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {slide.description}
            </p>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <p className="font-medium text-foreground text-xs">
                {slide.hotspot}
              </p>
            </div>
          </div>

          {/* Right: mock UI */}
          <div className="overflow-hidden rounded-xl border border-border bg-muted/20 p-3">
            {slide.mock}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-border/50 border-t bg-muted/20 px-6 py-4">
          <button
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            onClick={dismiss}
          >
            Pular tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 font-medium text-sm transition-colors hover:bg-muted"
                onClick={() => setCurrent((c) => c - 1)}
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Anterior
              </button>
            )}
            {isLast ? (
              <button
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90"
                onClick={dismiss}
              >
                Começar a usar →
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90"
                onClick={() => setCurrent((c) => c + 1)}
              >
                Próximo
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
