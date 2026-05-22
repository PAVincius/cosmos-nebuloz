import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { getSynergyMatrix } from "@/app/actions/flow-intelligence/synergy";
import { SynergyMatrix } from "./synergy-matrix";

export async function SynergyTab({ teamId }: { teamId: string }) {
  const { tenantId, role } = await requireTenantSession(await headers());
  const isSM = role === "SM" || role === "RTE" || role === "ADMIN";

  const [matrixResult, baselines] = await Promise.all([
    getSynergyMatrix(teamId),
    database.memberThroughputBaseline.findMany({
      where: { tenantId, teamId },
      select: { userId: true },
    }),
  ]);

  const userIds = baselines.map((b) => b.userId);

  if (!matrixResult.ok) {
    return (
      <p className="text-muted-foreground text-sm">{matrixResult.error}</p>
    );
  }

  const topPairs = matrixResult.data.pairs
    .filter((p) => p.hasEnoughData && p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
          Matriz de Sinergia
        </p>
        {userIds.length < 2 ? (
          <div className="rounded-xl border border-dashed bg-muted/5 py-12 text-center text-muted-foreground text-sm">
            <p>Aguardando dados de tarefas co-atribuídas.</p>
            <p className="mt-1 text-xs">
              Mínimo: 2 membros + tarefas concluídas juntos.
            </p>
          </div>
        ) : (
          <SynergyMatrix
            isSM={isSM}
            pairs={matrixResult.data.pairs}
            userIds={userIds}
          />
        )}
      </div>

      {topPairs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            Melhores Combinações
          </p>
          <div className="space-y-2">
            {topPairs.map((p) => (
              <div
                className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs"
                key={`${p.userId1}|${p.userId2}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {p.userId1.slice(-6)} + {p.userId2.slice(-6)}
                  </span>
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    +{Math.round(p.score)}% · {p.samples} tarefas
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
