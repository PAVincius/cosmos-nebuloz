"use client";

// Story-028 AC-004: diff panel — added=green, removed=red
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { MinusCircleIcon, PlusCircleIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import type { DiffChange } from "../actions";
import { diffBpmnDefinitions } from "../actions";

type Props = {
  draftId: string;
  activeId: string;
  onClose: () => void;
};

export function BpmnDiffPanel({ draftId, activeId, onClose }: Props) {
  const [changes, setChanges] = useState<DiffChange[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function runDiff() {
    startTransition(async () => {
      const result = await diffBpmnDefinitions(draftId, activeId);
      setChanges(result);
    });
  }

  const added = changes?.filter((c) => c.type === "added") ?? [];
  const removed = changes?.filter((c) => c.type === "removed") ?? [];

  return (
    <div className="flex w-80 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold text-sm">Comparar com versão ativa</span>
        <Button onClick={onClose} size="icon" variant="ghost">
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {changes === null ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-center text-muted-foreground text-sm">
              Compare este rascunho com a definição ativa.
            </p>
            <Button disabled={isPending} onClick={runDiff} size="sm">
              {isPending ? "Comparando…" : "Calcular diff"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge className="bg-green-100 text-green-700">
                +{added.length} adicionado{added.length !== 1 ? "s" : ""}
              </Badge>
              <Badge className="bg-red-100 text-red-700">
                -{removed.length} removido{removed.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {added.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-green-700 text-xs uppercase tracking-wide">
                  Adicionados
                </p>
                <ul className="space-y-1">
                  {added.map((c) => (
                    <li
                      className="flex items-center gap-2 rounded bg-green-50 px-3 py-1.5 text-green-800 text-xs"
                      key={c.id}
                    >
                      <PlusCircleIcon className="h-3.5 w-3.5 shrink-0 text-green-600" />
                      <span className="truncate font-mono">{c.id}</span>
                      {c.label && (
                        <span className="ml-auto text-[10px] text-green-500">
                          {c.kind}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {removed.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-red-700 text-xs uppercase tracking-wide">
                  Removidos
                </p>
                <ul className="space-y-1">
                  {removed.map((c) => (
                    <li
                      className="flex items-center gap-2 rounded bg-red-50 px-3 py-1.5 text-red-800 text-xs"
                      key={c.id}
                    >
                      <MinusCircleIcon className="h-3.5 w-3.5 shrink-0 text-red-600" />
                      <span className="truncate font-mono">{c.id}</span>
                      {c.label && (
                        <span className="ml-auto text-[10px] text-red-500">
                          {c.kind}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {changes.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">
                Nenhuma diferença encontrada.
              </p>
            )}

            <Button
              className="w-full"
              onClick={runDiff}
              size="sm"
              variant="outline"
            >
              Recalcular
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
