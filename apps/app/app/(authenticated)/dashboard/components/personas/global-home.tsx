import {
  AlertTriangle,
  BellOff,
  DollarSign,
  GitBranch,
  Layers,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import {
  RelationChip,
  type RelationChipTone,
} from "@/app/(authenticated)/components/relation-chip";
import {
  BentoCell,
  BentoGrid,
  CellEyebrow,
  CellLabel,
  CellSub,
} from "../bento-cell";
import { NotificationsCell } from "../notifications-cell";

// ECG-style trend icon reused from prototype's mkpi2 KPI treatment
const ICON_LAYERS =
  "M12 2 2 7l10 5 10-5-10-5 M2 12l10 5 10-5 M2 17l10 5 10-5";
const ICON_BELL =
  "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0";

type QuickLink = {
  eyebrow: string;
  label: string;
  href: string;
  icon: ReactNode;
  tone: RelationChipTone;
};

const QUICK_LINKS: QuickLink[] = [
  {
    eyebrow: "Portfolio",
    label: "Épicos",
    href: "/portfolio",
    icon: <Layers />,
    tone: "blue",
  },
  {
    eyebrow: "Estratégia",
    label: "OKRs",
    href: "/portfolio/okrs",
    icon: <Target />,
    tone: "purple",
  },
  {
    eyebrow: "Compliance",
    label: "Governança",
    href: "/portfolio/governance",
    icon: <ShieldCheck />,
    tone: "green",
  },
  {
    eyebrow: "Financeiro",
    label: "Lean Budget",
    href: "/portfolio/budgets",
    icon: <DollarSign />,
    tone: "amber",
  },
  {
    eyebrow: "Risco",
    label: "ROAM Board",
    href: "/risks",
    icon: <AlertTriangle />,
    tone: "red",
  },
  {
    eyebrow: "Times",
    label: "Squads",
    href: "/teams",
    icon: <Users />,
    tone: "accent",
  },
  {
    eyebrow: "Priorização",
    label: "WSJF",
    href: "/portfolio/wsjf",
    icon: <TrendingUp />,
    tone: "purple",
  },
  {
    eyebrow: "Budget",
    label: "Anomalias",
    href: "/portfolio/budgets/anomalies",
    icon: <AlertTriangle />,
    tone: "amber",
  },
  {
    eyebrow: "Execução",
    label: "Dependencies",
    href: "/dependencies",
    icon: <GitBranch />,
    tone: "neutral",
  },
];

type GlobalHomeProps = {
  arts: Array<{ id: string; name: string }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    createdAt: Date;
    metadata: unknown;
  }>;
};

export default function GlobalHome({ arts, notifications }: GlobalHomeProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI row */}
      <KpiGrid cols={2}>
        <KpiCard
          badge={arts.length > 0 ? "Trens ativos" : "Nenhum configurado"}
          iconPath={ICON_LAYERS}
          label="ARTs configurados"
          tone="blue"
          value={arts.length}
        />
        <KpiCard
          badge={unreadCount > 0 ? "Requer atenção" : "Tudo em dia"}
          iconPath={ICON_BELL}
          label="Notificações"
          tone={unreadCount > 0 ? "amber" : "green"}
          unit={unreadCount === 1 ? "não lida" : "não lidas"}
          value={unreadCount}
        />
      </KpiGrid>

      <BentoGrid>
        {/* ARTs overview */}
        <BentoCell span={2}>
          <CellEyebrow
            action={{ label: "ver todos →", href: "/arts" }}
            label="ARTs"
          />
          {arts.length === 0 ? (
            <CellSub>
              <span
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Layers size={13} strokeWidth={2} />
                Nenhum ART configurado.{" "}
                <Link href="/arts" style={{ color: "var(--accent-c)" }}>
                  + Adicionar
                </Link>
              </span>
            </CellSub>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              {arts.map((art) => (
                <Link
                  href={`/arts/${art.id}`}
                  key={art.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textDecoration: "none",
                    padding: "6px 0",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--green)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                    {art.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </BentoCell>

        {/* Notifications */}
        <BentoCell accentColor="#5e6ad2" priority="critical" span={2}>
          <CellEyebrow
            action={{ label: "ver todas →", href: "/notifications" }}
            label="Notificações"
          />
          {notifications.length === 0 ? (
            <CellSub>
              <span
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <BellOff size={13} strokeWidth={2} />
                Nenhuma notificação
              </span>
            </CellSub>
          ) : (
            <NotificationsCell notifications={notifications} />
          )}
        </BentoCell>

        {/* Quick access / cross-nav */}
        <BentoCell span={4}>
          <CellEyebrow label="Acesso rápido" />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 8,
            }}
          >
            {QUICK_LINKS.map((link) => (
              <RelationChip
                eyebrow={link.eyebrow}
                href={link.href}
                icon={link.icon}
                key={link.href}
                label={link.label}
                tone={link.tone}
              />
            ))}
          </div>
        </BentoCell>

        {/* Welcome card */}
        <BentoCell span={4}>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 8,
                letterSpacing: "-0.4px",
              }}
            >
              Bem-vindo ao COSMOS
            </h2>
            <CellLabel>
              Configure sua persona no perfil para uma experiência
              personalizada.
            </CellLabel>
            <Link
              href="/profile"
              style={{
                display: "inline-block",
                marginTop: 12,
                fontSize: 13,
                color: "var(--accent-c)",
                textDecoration: "none",
              }}
            >
              Configurar persona →
            </Link>
          </div>
        </BentoCell>
      </BentoGrid>
    </div>
  );
}
