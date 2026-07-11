import { Button } from "@repo/design-system/components/ui/button";
import { AlertTriangleIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { listAuditLogs } from "../../../actions/audit/index";
import { AuditLogTable } from "./components/audit-log-table";

export const metadata = {
  title: "Audit Log | Configurações | COSMOS",
  description: "Histórico de ações no workspace",
};

type SearchParams = { entityType?: string; period?: string };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const periodDays = params.period ? Number.parseInt(params.period, 10) : 30;
  const entityType = params.entityType ?? undefined;

  const from = new Date();
  from.setDate(from.getDate() - periodDays);

  const result = await listAuditLogs({ entityType, from, page: 1, limit: 50 });
  const logs = result.ok ? result.data.items : [];

  const csvParams = new URLSearchParams();
  if (entityType) {
    csvParams.set("entityType", entityType);
  }
  csvParams.set("period", String(periodDays));

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="167,139,250"
        actions={
          <Button asChild className="gap-2" size="sm" variant="outline">
            <Link href={`/api/audit/export?${csvParams.toString()}`}>
              <DownloadIcon className="size-4" />
              Exportar CSV
            </Link>
          </Button>
        }
        breadcrumb={[{ label: "Configurações", href: "/settings/workspace" }]}
        subtitle={`Registro imutável de ações no workspace — histórico dos últimos ${periodDays} dias.`}
        title="Audit Log"
      />

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {!result.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
            <AlertTriangleIcon className="size-4 shrink-0" />
            <span>
              Falha ao carregar o audit log: {result.error}.{" "}
              <a className="underline" href="/settings/audit">
                Tentar novamente
              </a>
            </span>
          </div>
        )}

        <AuditLogTable
          entityType={entityType}
          logs={logs}
          periodDays={periodDays}
        />
      </div>
    </div>
  );
}
