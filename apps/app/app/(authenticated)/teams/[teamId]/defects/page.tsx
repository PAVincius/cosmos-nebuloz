import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { getTeamById } from "../actions";
import { listDefects } from "@/app/actions/defects";
import { CreateDefectDialog } from "./components/create-defect-dialog";
import { DefectActions } from "./components/defect-actions";
import { appDesign } from "@/lib/app-design";

interface DefectsPageProps {
  params: Promise<{ teamId: string }>;
}

const SEVERITY_VARIANTS: Record<
  string,
  "destructive" | "default" | "secondary" | "outline"
> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const STATUS_VARIANTS: Record<
  string,
  "destructive" | "default" | "secondary" | "outline"
> = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em Progresso",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};

export async function generateMetadata({ params }: DefectsPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team ? `Defects — ${team.name} | COSMOS` : "Defects | COSMOS",
  };
}

export default async function DefectsPage({ params }: DefectsPageProps) {
  const { teamId } = await params;

  const [team, defectsResult] = await Promise.all([
    getTeamById(teamId),
    listDefects({ teamId, page: 1, limit: 100 }),
  ]);

  if (!team) notFound();

  const defects = defectsResult.ok ? defectsResult.data.items : [];

  const openCount = defects.filter((d) => d.status === "OPEN").length;
  const criticalCount = defects.filter((d) => d.severity === "critical").length;

  return (
    <div className={appDesign.shell}>
      <div className={appDesign.pageHeader}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            <Link href={`/teams/${teamId}`} className="hover:underline">
              {team.name}
            </Link>
            {" / Defects"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Defects</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{defects.length} total</span>
            {openCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {openCount} abertos
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} críticos
              </Badge>
            )}
          </div>
        </div>
        <CreateDefectDialog teamId={teamId} />
      </div>
      </div>
      <div className={appDesign.bodyScroll}>
      <div className="flex flex-col gap-6">
      {/* Table */}
      {defects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">Nenhum defect registrado.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Registre o primeiro defect quando encontrar um problema.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="w-28">Severidade</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-36">Criado em</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {defects.map((defect) => (
                <TableRow key={defect.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{defect.title}</p>
                      {defect.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                          {defect.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={SEVERITY_VARIANTS[defect.severity] ?? "secondary"}>
                      {SEVERITY_LABELS[defect.severity] ?? defect.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[defect.status] ?? "secondary"}>
                      {STATUS_LABELS[defect.status] ?? defect.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(defect.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <DefectActions
                      defectId={defect.id}
                      currentStatus={defect.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
