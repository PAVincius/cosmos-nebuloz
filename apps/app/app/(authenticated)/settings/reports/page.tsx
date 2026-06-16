import { Badge } from "@repo/design-system/components/ui/badge";
import { CalendarIcon, MailIcon } from "lucide-react";
import { listScheduledReports } from "@/app/actions/reporting/scheduled-reports";
import { appDesign } from "@/lib/app-design";
import { PageHeader } from "../../components/page-header";
import { CreateReportButton, ReportActions } from "./reports-client";

export const metadata = {
  title: "Relatórios Agendados | Configurações | COSMOS",
  description: "Gerencie relatórios automáticos de PI e portfolio",
};

type ReportExecution = {
  status: string;
  executedAt: Date | null;
  pdfUrl: string | null;
};

type ScheduledReportItem = {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  recipients: string[];
  slackChannelId: string | null;
  executions: ReportExecution[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  RUNNING: "Executando",
  SUCCESS: "Sucesso",
  FAILED: "Falha",
};

export default async function ReportsPage() {
  const result = await listScheduledReports({});
  const reports = (result.ok ? result.data.items : []) as ScheduledReportItem[];

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={<CreateReportButton />}
        breadcrumb={[
          { label: "Configurações", href: "/settings/workspace" },
          { label: "Relatórios" },
        ]}
        subtitle="Agende envios automáticos de relatórios PDF por e-mail ou Slack."
        title="Relatórios Agendados"
      />
      <div className={appDesign.bodyScroll}>
        {reports.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum relatório agendado ainda. Clique em "Novo Relatório" para
            criar.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {reports.map((report) => {
              const lastRun = report.executions[0];
              return (
                <li className="p-4" key={report.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{report.name}</p>
                        {!report.enabled && (
                          <Badge variant="secondary">Pausado</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {report.cronExpression}
                        </span>
                        <span className="flex items-center gap-1">
                          <MailIcon className="h-3 w-3" />
                          {report.recipients.slice(0, 2).join(", ")}
                          {report.recipients.length > 2 &&
                            ` +${report.recipients.length - 2}`}
                        </span>
                        {report.slackChannelId && (
                          <span># {report.slackChannelId}</span>
                        )}
                      </div>
                      {lastRun && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Última execução:
                          </span>
                          <Badge
                            variant={
                              lastRun.status === "SUCCESS"
                                ? "default"
                                : lastRun.status === "FAILED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {STATUS_LABELS[lastRun.status] ?? lastRun.status}
                          </Badge>
                          {lastRun.executedAt && (
                            <span className="text-muted-foreground">
                              {new Date(lastRun.executedAt).toLocaleString(
                                "pt-BR"
                              )}
                            </span>
                          )}
                          {lastRun.pdfUrl && (
                            <a
                              className="text-primary underline"
                              href={lastRun.pdfUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Download PDF
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <ReportActions report={report} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
