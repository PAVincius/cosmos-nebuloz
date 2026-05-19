import { notFound } from "next/navigation";
import {
  getStrategicThemeById,
  listThemeAuditHistory,
  listTenantRisks,
} from "@/app/actions/strategic-themes";
import { getARTs } from "@/app/actions/arts/get-arts";
import { listBudgetsByTheme, listLeanBudgets } from "@/app/actions/lean-budget";
import { ThemeDetail } from "./components/theme-detail";
import { PageHeader } from "@/app/(authenticated)/components/page-header";

export const metadata = {
  title: "Detalhe do Tema Estratégico - COSMOS",
};

export default async function ThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [themeResult, history, arts, risksResult, linkedBudgetsResult, allBudgetsResult] = await Promise.all([
    getStrategicThemeById(id),
    listThemeAuditHistory(id),
    getARTs(),
    listTenantRisks(),
    listBudgetsByTheme(id),
    listLeanBudgets(),
  ]);

  if (!themeResult.ok) notFound();

  const auditLogs     = history.ok            ? history.data            : [];
  const allArts       = arts.map((a) => ({ id: a.id, name: a.name }));
  const allRisks      = risksResult.ok        ? risksResult.data        : [];
  const linkedBudgets = linkedBudgetsResult.ok ? linkedBudgetsResult.data : [];
  const allBudgets    = allBudgetsResult.ok   ? allBudgetsResult.data   : [];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <PageHeader
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Temas Estratégicos", href: "/portfolio/themes" },
        ]}
        title={themeResult.data.title}
        subtitle="Tema Estratégico SAFe"
      />

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <ThemeDetail
          theme={themeResult.data}
          auditLogs={auditLogs}
          allArts={allArts}
          allRisks={allRisks}
          linkedBudgets={linkedBudgets}
          allBudgets={allBudgets}
        />
      </div>
    </div>
  );
}
