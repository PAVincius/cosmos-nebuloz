import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon } from "lucide-react";
import { getTeamById } from "../actions";
import { listImpediments } from "@/app/actions/impediments";
import { CreateImpedimentDialog } from "./components/create-impediment-dialog";
import { ResolveImpedimentButton } from "./components/resolve-impediment-button";

interface ImpedimentsPageProps {
  params: Promise<{ teamId: string }>;
}

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
  if (status === "RESOLVED") return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
  if (status === "IN_PROGRESS") return <ClockIcon className="h-4 w-4 text-blue-500" />;
  return <AlertTriangleIcon className="h-4 w-4 text-red-500" />;
}

export async function generateMetadata({ params }: ImpedimentsPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team ? `Impedimentos — ${team.name} | COSMOS` : "Impedimentos | COSMOS",
  };
}

export default async function ImpedimentsPage({ params }: ImpedimentsPageProps) {
  const { teamId } = await params;

  const [team, impedimentsResult] = await Promise.all([
    getTeamById(teamId),
    listImpediments({ teamId, page: 1, limit: 100 }),
  ]);

  if (!team) notFound();

  const impediments = impedimentsResult.ok ? impedimentsResult.data.items : [];

  const openImpediments = impediments.filter((i) => i.status !== "RESOLVED");
  const resolvedImpediments = impediments.filter((i) => i.status === "RESOLVED");

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            <Link href={`/teams/${teamId}`} className="hover:underline">
              {team.name}
            </Link>
            {" / Impedimentos"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Impedimentos</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{impediments.length} total</span>
            {openImpediments.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {openImpediments.length} abertos
              </Badge>
            )}
          </div>
        </div>
        <CreateImpedimentDialog teamId={teamId} />
      </div>

      {/* Open impediments */}
      {openImpediments.length === 0 && resolvedImpediments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CheckCircle2Icon className="h-8 w-8 text-green-500 mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum impedimento registrado.</p>
        </div>
      ) : (
        <>
          {openImpediments.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Ativos
              </h2>
              <div className="flex flex-col gap-3">
                {openImpediments.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-lg border p-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <StatusIcon status={item.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{item.title}</p>
                          <Badge variant={STATUS_VARIANTS[item.status] ?? "secondary"} className="text-xs">
                            {STATUS_LABELS[item.status] ?? item.status}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>
                            Criado em {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                          {item.ownerUserId && (
                            <span>Responsável: {item.ownerUserId.slice(0, 8)}</span>
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
              <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Resolvidos
              </h2>
              <div className="flex flex-col gap-2">
                {resolvedImpediments.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 opacity-60"
                  >
                    <CheckCircle2Icon className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm line-through text-muted-foreground">{item.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
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
  );
}
