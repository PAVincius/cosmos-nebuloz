import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { GitBranchIcon, WorkflowIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata = {
  title: "Workflows | COSMOS",
  description: "Fluxos BPMN 2.0 por equipe",
};

async function getTeamsWithWorkflows(tenantId: string) {
  const teams = await database.team.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      artId: true,
      art: { select: { name: true } },
    },
  });

  const definitions = await database.bpmnDefinition.findMany({
    where: { tenantId },
    select: { teamId: true, version: true, updatedAt: true },
    orderBy: { version: "desc" },
    distinct: ["teamId"],
  });

  const defMap = new Map(definitions.map((d) => [d.teamId, d]));

  return teams.map((t) => ({ ...t, definition: defMap.get(t.id) ?? null }));
}

export default async function WorkflowsPage() {
  const ctx = await requireTenantSession(await headers());
  const teams = await getTeamsWithWorkflows(ctx.tenantId);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-bold text-2xl tracking-tight">Workflows</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Modelagem visual de fluxos BPMN 2.0 por equipe
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <WorkflowIcon className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-sm">Nenhuma equipe encontrada</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Crie equipes em ARTs para modelar fluxos BPMN
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => (
            <Link
              className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary hover:shadow-md"
              href={`/workflows/${team.id}/bpmn`}
              key={team.id}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <WorkflowIcon className="h-4 w-4" />
                </div>
                {team.definition ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-[10px] text-emerald-700 uppercase tracking-wider dark:bg-emerald-900 dark:text-emerald-300">
                    v{team.definition.version}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-[10px] text-slate-500 uppercase tracking-wider dark:bg-slate-800 dark:text-slate-400">
                    novo
                  </span>
                )}
              </div>

              <p className="font-semibold leading-tight group-hover:text-primary">
                {team.name}
              </p>

              {team.art !== null && team.art !== undefined && (
                <p className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
                  <GitBranchIcon className="h-3 w-3" />
                  {team.art.name}
                </p>
              )}

              {team.definition ? (
                <p className="mt-3 text-muted-foreground text-xs">
                  Atualizado{" "}
                  {new Date(team.definition.updatedAt).toLocaleDateString(
                    "pt-BR"
                  )}
                </p>
              ) : (
                <p className="mt-3 text-muted-foreground text-xs">
                  Nenhum diagrama salvo — clique para criar
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
