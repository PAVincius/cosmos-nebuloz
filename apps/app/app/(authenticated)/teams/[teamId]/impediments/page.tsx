import { Badge } from "@repo/design-system/components/ui/badge";
import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { listImpediments } from "@/app/actions/impediments";
import { appDesign } from "@/lib/app-design";
import { getTeamById } from "../actions";
import { CreateImpedimentDialog } from "./components/create-impediment-dialog";
import { ResolveImpedimentButton } from "./components/resolve-impediment-button";

type ImpedimentsPageProps = {
  params: Promise<{ teamId: string }>;
};

const STATUS_VARIANTS: Record<
  string,
  "destructive" | "default" | "secondary" | "outline"
> = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  RESOLVED: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em Andamento",
  RESOLVED: "Resolvido",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "RESOLVED") {
    return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
  }
  if (status === "IN_PROGRESS") {
    return <ClockIcon className="h-4 w-4 text-blue-500" />;
  }
  return <AlertTriangleIcon className="h-4 w-4 text-red-500" />;
}

export async function generateMetadata({ params }: ImpedimentsPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team
      ? `Impedimentos — ${team.name} | COSMOS`
      : "Impedimentos | COSMOS",
  };
}

export default async function ImpedimentsPage({
  params,
}: ImpedimentsPageProps) {
  const { teamId } = await params;

  const [team, impedimentsResult] = await Promise.all([
    getTeamById(teamId),
    listImpediments({ teamId, page: 1, limit: 100 }),
  ]);

  if (!team) {
    notFound();
  }

  const impediments = impedimentsResult.ok ? impedimentsResult.data.items : [];

  const openImpediments = impediments.filter((i) => i.status !== "RESOLVED");
  const resolvedImpediments = impediments.filter(
    (i) => i.status === "RESOLVED"
  );

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={<CreateImpedimentDialog teamId={teamId} />}
        breadcrumb={[
          { label: team.name, href: `/teams/${teamId}` },
          { label: "Impedimentos" },
        ]}
        stats={[
          { label: "Total", value: impediments.length },
          {
            label: "Abertos",
            value: openImpediments.length,
            icon: AlertTriangleIcon,
          },
          {
            label: "Resolvidos",
            value: resolvedImpediments.length,
            icon: CheckCircle2Icon,
          },
        ]}
        title="Impedimentos"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* Open impediments */}
          {openImpediments.length === 0 && resolvedImpediments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <CheckCircle2Icon className="mb-2 h-8 w-8 text-green-500" />
              <p className="text-muted-foreground text-sm">
                Nenhum impedimento registrado.
              </p>
            </div>
          ) : (
            <>
              {openImpediments.length > 0 && (
                <section>
                  <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                    Ativos
                  </h2>
                  <div className="flex flex-col gap-3">
                    {openImpediments.map((item) => (
                      <div
                        className="flex items-start justify-between gap-4 rounded-lg border p-4"
                        key={item.id}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon status={item.status} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm">
                                {item.title}
                              </p>
                              <Badge
                                className="text-xs"
                                variant={
                                  STATUS_VARIANTS[item.status] ?? "secondary"
                                }
                              >
                                {STATUS_LABELS[item.status] ?? item.status}
                              </Badge>
                            </div>
                            {!!item.description && (
                              <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
                              <span>
                                Criado em{" "}
                                {new Date(item.createdAt).toLocaleDateString(
                                  "pt-BR"
                                )}
                              </span>
                              {!!item.ownerUserId && (
                                <span>
                                  Responsável: {item.ownerUserId.slice(0, 8)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {item.status !== "RESOLVED" && (
                          <ResolveImpedimentButton impedimentId={item.id} />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {resolvedImpediments.length > 0 && (
                <section>
                  <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                    Resolvidos
                  </h2>
                  <div className="flex flex-col gap-2">
                    {resolvedImpediments.map((item) => (
                      <div
                        className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 opacity-60"
                        key={item.id}
                      >
                        <CheckCircle2Icon className="h-4 w-4 shrink-0 text-green-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-muted-foreground text-sm line-through">
                            {item.title}
                          </p>
                        </div>
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {item.resolvedAt
                            ? `Resolvido em ${new Date(item.resolvedAt).toLocaleDateString("pt-BR")}`
                            : "Resolvido"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
