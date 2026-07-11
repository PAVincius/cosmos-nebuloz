import { LayoutGridIcon, PlusIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CosmosButton } from "@repo/design-system/components/cosmos/cosmos-button";
import type { ProgramBoardData } from "@/app/actions/program-board/schema";

type Objective = {
  id: string;
  title: string;
  businessValue: number | null;
  isStretch: boolean;
  status: string | null;
};

type ProgramBoardBodyProps = {
  artId: string;
  boardData: ProgramBoardData | null;
  hasPiPlans: boolean;
  objectives: Objective[];
  children: ReactNode;
};

/** Empty/error states + PI objectives panel wrapping the Program Board grid. */
export function ProgramBoardBody({
  artId,
  boardData,
  hasPiPlans,
  objectives,
  children,
}: ProgramBoardBodyProps) {
  if (!hasPiPlans) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-cosmos-lg border border-hairline bg-surface py-16 text-center shadow-cosmos-card">
        <LayoutGridIcon aria-hidden className="h-9 w-9 text-ink-muted" />
        <div>
          <p className="font-semibold text-ink text-sm">
            Nenhum PI criado ainda
          </p>
          <p className="mt-1 text-ink-muted text-xs">
            Crie um PI Plan para visualizar o Program Board.
          </p>
        </div>
        <Link href={`/arts/${artId}`}>
          <CosmosButton size="md" variant="primary">
            <PlusIcon aria-hidden size={14} strokeWidth={2.4} />
            Criar PI Plan
          </CosmosButton>
        </Link>
      </div>
    );
  }

  if (!boardData) {
    return (
      <div className="rounded-cosmos-lg border border-hairline bg-surface py-16 text-center text-ink-muted text-sm shadow-cosmos-card">
        Selecione um PI Plan para visualizar o board.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {objectives.length > 0 && (
        <details className="rounded-cosmos-lg border border-hairline bg-surface" open>
          <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 font-semibold text-ink text-sm">
            <TargetIcon aria-hidden className="h-4 w-4 text-ink-muted" />
            Objetivos PI ({objectives.length})
          </summary>
          <div className="border-hairline border-t px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {objectives.map((obj) => (
                <div
                  className="flex items-center gap-2 rounded-cosmos-md border border-hairline bg-surface-2 px-3 py-1.5 text-[11.5px]"
                  key={obj.id}
                >
                  <span className="font-semibold text-ink">{obj.title}</span>
                  {obj.businessValue !== null && (
                    <span className="text-ink-muted">
                      BV {obj.businessValue}
                    </span>
                  )}
                  {obj.isStretch && (
                    <span className="rounded-cosmos-pill bg-amber-soft px-[7px] py-px font-bold text-[10px] text-amber-text">
                      Stretch
                    </span>
                  )}
                  <span className="rounded-cosmos-pill bg-surface-3 px-[7px] py-px font-bold text-[10px] text-ink-muted">
                    {obj.status ?? "PLANNED"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
