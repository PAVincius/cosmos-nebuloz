import { AlertTriangle, Shield } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import type { PageMeta } from "@/app/actions/_base";
import { listDecisionLog } from "@/app/actions/governance";
import type { DecisionLogEntryPublic } from "@/app/actions/governance/schema";
import { appDesign } from "@/lib/app-design";
import { DecisionLogTable } from "./components/decision-log-table";

export const metadata = { title: "Decision Log — COSMOS" };

const EMPTY_META: PageMeta = {
  total: 0,
  page: 1,
  limit: 50,
  pageCount: 0,
  hasNext: false,
  hasPrev: false,
};

export default async function DecisionLogPage() {
  const result = await listDecisionLog();
  const items: DecisionLogEntryPublic[] = result.ok ? result.data.items : [];
  const meta: PageMeta = result.ok ? result.data.meta : EMPTY_META;

  const approvedCount = items.filter((i) => i.decisao === "approved").length;
  const rejectedCount = items.filter((i) => i.decisao === "rejected").length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="167,139,250"
        actions={
          <RelationChip
            eyebrow="Governança"
            href="/portfolio/governance"
            icon={<Shield />}
            label="Governance Board"
            tone="accent"
          />
        }
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Governança", href: "/portfolio/governance" },
        ]}
        stats={[
          { label: "Decisões", value: meta.total },
          { label: "Aprovadas", value: approvedCount },
          { label: "Rejeitadas", value: rejectedCount },
        ]}
        subtitle="Histórico auditável de decisões de portfolio — cada aprovação, rejeição ou adiamento fica registrado aqui."
        title="Decision Log"
      />

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {!result.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
            <AlertTriangle aria-hidden size={16} />
            <span>
              Falha ao carregar o decision log: {result.error}.{" "}
              <a
                className="underline"
                href="/portfolio/governance/decision-log"
              >
                Tentar novamente
              </a>
            </span>
          </div>
        )}

        <DecisionLogTable items={items} meta={meta} />
      </div>
    </div>
  );
}
