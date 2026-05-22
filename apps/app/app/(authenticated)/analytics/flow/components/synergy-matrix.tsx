"use client";

import { cn } from "@repo/design-system/lib/utils";
import type { SynergyPair } from "@/app/actions/flow-intelligence/synergy";

type Props = {
  pairs: SynergyPair[];
  userIds: string[];
  isSM?: boolean;
};

function scoreColor(score: number, hasData: boolean): string {
  if (!hasData) {
    return "bg-muted/30 text-muted-foreground";
  }
  if (score > 20) {
    return "bg-green-500/20 text-green-700 dark:text-green-400";
  }
  if (score > 0) {
    return "bg-green-500/10 text-green-600 dark:text-green-500";
  }
  if (score > -15) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "bg-red-500/15 text-red-700 dark:text-red-400";
}

const shortId = (id: string) =>
  id.split("-").pop()?.slice(0, 8) ?? id.slice(0, 8);

function renderCellContent(
  pair: SynergyPair | undefined,
  showScore: boolean
): React.ReactNode {
  if (!pair) {
    return "—";
  }
  if (!pair.hasEnoughData) {
    return <span title="Dados insuficientes">⚠</span>;
  }
  if (!showScore) {
    return "—";
  }
  return (
    <>
      {pair.score > 0 ? "+" : ""}
      {Math.round(pair.score)}%
    </>
  );
}

function SynergyCell({
  rowId,
  colId,
  isSM,
  pairMap,
}: {
  rowId: string;
  colId: string;
  isSM: boolean;
  pairMap: Map<string, SynergyPair>;
}): React.ReactElement {
  if (rowId === colId) {
    return <td className="bg-muted/20 p-2" key={colId} />;
  }

  const key = [rowId, colId].sort().join("|");
  const cellPair = pairMap.get(key);

  if (!cellPair) {
    return (
      <td className="p-2 text-center text-muted-foreground/50" key={colId}>
        —
      </td>
    );
  }

  const showScore = isSM || cellPair.score > 0;
  const title = `${cellPair.samples} tarefas · confiança: ${Math.round(cellPair.confidence * 100)}%`;

  return (
    <td
      className={cn(
        "rounded p-2 text-center font-medium tabular-nums",
        scoreColor(showScore ? cellPair.score : 0, cellPair.hasEnoughData)
      )}
      key={colId}
      title={title}
    >
      {renderCellContent(cellPair, showScore)}
    </td>
  );
}

export function SynergyMatrix({ pairs, userIds, isSM = false }: Props) {
  if (userIds.length < 2) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Necessário pelo menos 2 membros com baseline calculado.
      </p>
    );
  }

  const pairMap = new Map<string, SynergyPair>();
  for (const p of pairs) {
    const key = [p.userId1, p.userId2].sort().join("|");
    pairMap.set(key, p);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-24 p-2 text-left font-medium text-muted-foreground" />
            {userIds.map((uid) => (
              <th
                className="max-w-20 p-2 text-center font-medium text-muted-foreground"
                key={uid}
              >
                <span className="block truncate" title={uid}>
                  {shortId(uid)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {userIds.map((rowId) => (
            <tr key={rowId}>
              <td className="p-2 font-medium text-muted-foreground">
                <span className="block max-w-20 truncate" title={rowId}>
                  {shortId(rowId)}
                </span>
              </td>
              {userIds.map((colId) => (
                <SynergyCell
                  colId={colId}
                  isSM={isSM}
                  key={colId}
                  pairMap={pairMap}
                  rowId={rowId}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-muted-foreground">
        % = desvio vs baselines individuais. ⚠ = dados insuficientes.
        {!isSM && " Scores negativos visíveis apenas para SM."}
      </p>
    </div>
  );
}
