import { Badge } from "@repo/design-system/components/cosmos/badge";
import { AlertTriangle, Clock, Shield } from "lucide-react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import {
  listApprovalRequests,
  listGovernedEpics,
} from "@/app/actions/governance";
import { appDesign } from "@/lib/app-design";
import { GovernanceEpicList } from "./components/governance-epic-list";

export const metadata = { title: "Governança de Épicos — COSMOS" };

const ICON_SHIELD =
  "M20 13c0 5-3.5 7.5-7.35 8.85a1 1 0 01-.6 0C8.5 20.5 5 18 5 13V6.3a2 2 0 011.4-1.9L12 2.4l5.6 2a2 2 0 011.4 1.9z";
const ICON_CLOCK = "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2";
const ICON_BUDGET = "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6";
const ICON_GAUGE = "M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0";

export default async function GovernancePage() {
  const [epicsResult, requestsResult] = await Promise.all([
    listGovernedEpics(),
    listApprovalRequests(),
  ]);

  const epics = epicsResult.ok ? epicsResult.data : [];
  const requests = requestsResult.ok ? requestsResult.data : [];

  const reviewEpics = epics.filter((e) => e.governanceStatus === "review");
  const approvedCount = epics.filter(
    (e) => e.governanceStatus === "approved"
  ).length;
  const budgetInReview = reviewEpics.reduce(
    (sum, e) => sum + (e.investmentEstimate ?? 0),
    0
  );

  // Days since the last status change for epics currently in review — a proxy
  // for "time in gate" derived from data already fetched (no new query).
  const avgDaysInGate =
    reviewEpics.length > 0
      ? reviewEpics.reduce((sum, e) => {
          const days =
            (Date.now() - new Date(e.updatedAt).getTime()) /
            (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / reviewEpics.length
      : 0;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="52,211,153"
        actions={
          <RelationChip
            eyebrow="Auditoria"
            href="/portfolio/governance/decision-log"
            icon={<Clock />}
            label="Decision Log"
            tone="purple"
          />
        }
        badge={
          <Badge className="font-mono" tone="neutral">
            SAFe 6.0
          </Badge>
        }
        breadcrumb={[{ label: "Portfolio", href: "/portfolio" }]}
        stats={[
          { label: "Épicos no fluxo", value: epics.length, icon: Shield },
          { label: "Aguardando gate", value: reviewEpics.length, icon: Clock },
          { label: "Aprovados", value: approvedCount },
        ]}
        subtitle="Governança lean do portfólio. Épicos avançam por gates de decisão com investimento e dono claros — sem comitês pesados."
        title="Governança de Épicos"
      />

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {(!epicsResult.ok || !requestsResult.ok) && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
            <AlertTriangle aria-hidden size={16} />
            <span>
              Falha ao carregar dados de governança:{" "}
              {(!epicsResult.ok && epicsResult.error) ||
                (!requestsResult.ok && requestsResult.error) ||
                "erro desconhecido"}
              .{" "}
              <a className="underline" href="/portfolio/governance">
                Tentar novamente
              </a>
            </span>
          </div>
        )}

        <KpiGrid cols={4}>
          <KpiCard
            badge="— lean portfolio mgmt"
            iconPath={ICON_SHIELD}
            label="Épicos sob governança"
            tone="accent"
            value={epics.length}
          />
          <KpiCard
            badge="— em gate de revisão"
            iconPath={ICON_CLOCK}
            label="Aguardando decisão"
            tone="amber"
            value={reviewEpics.length}
          />
          <KpiCard
            badge="— pendente de aprovação"
            iconPath={ICON_BUDGET}
            label="Investimento em revisão"
            tone="blue"
            value={
              budgetInReview > 0
                ? `R$ ${budgetInReview.toLocaleString("pt-BR")}`
                : "R$ —"
            }
          />
          <KpiCard
            badge="— desde a última mudança de status"
            iconPath={ICON_GAUGE}
            label="Tempo médio no gate"
            tone="green"
            value={
              reviewEpics.length > 0
                ? avgDaysInGate.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })
                : "—"
            }
            unit={reviewEpics.length > 0 ? "d" : undefined}
          />
        </KpiGrid>

        <SectionCard
          icon={Shield}
          subtitle="Funil → Em Análise → Aprovado"
          title="Épicos por gate de governança"
        >
          <GovernanceEpicList epics={epics} requests={requests} />
        </SectionCard>
      </div>
    </div>
  );
}
