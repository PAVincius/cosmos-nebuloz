"use client";

import { useState } from "react";
import { ChevronRightIcon, ChevronDownIcon, GitBranchIcon, LayersIcon, TargetIcon } from "lucide-react";
import { Badge } from "@repo/design-system/components/ui/badge";
import type { OKRTraceabilityNode } from "@/app/actions/okrs";

const STATUS_COLOR: Record<string, string> = {
  ON_TRACK: "bg-green-500/10 text-green-700 border-green-400/30",
  AT_RISK:  "bg-amber-500/10 text-amber-700 border-amber-400/30",
  BEHIND:   "bg-red-500/10 text-red-700 border-red-400/30",
  ACHIEVED: "bg-blue-500/10 text-blue-700 border-blue-400/30",
};

const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "No Prazo", AT_RISK: "Em Risco", BEHIND: "Atrasado", ACHIEVED: "Atingido",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${value >= 80 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-7 text-right">{value}%</span>
    </div>
  );
}

type Props = { nodes: OKRTraceabilityNode[] };

export function OKRTraceabilityView({ nodes }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [expandedOKRs, setExpandedOKRs] = useState<Set<string>>(new Set());

  const withEpic    = nodes.filter((n) => n.epicId).length;
  const withoutEpic = nodes.filter((n) => !n.epicId).length;

  function toggleOKR(id: string) {
    setExpandedOKRs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Rastreabilidade OKR → Epic → Features</span>
          <Badge variant="outline" className="text-xs">{nodes.length} OKRs</Badge>
          {withoutEpic > 0 && (
            <span className="text-xs text-amber-600 font-medium">{withoutEpic} sem Epic vinculado</span>
          )}
        </div>
        {expanded ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t divide-y">
          {nodes.map((node) => {
            const isExpanded = expandedOKRs.has(node.okrId);
            const hasEpic = !!node.epicId;

            return (
              <div key={node.okrId}>
                {/* OKR row */}
                <button
                  type="button"
                  onClick={() => hasEpic && toggleOKR(node.okrId)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${hasEpic ? "hover:bg-muted/20 cursor-pointer" : "cursor-default"}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {hasEpic ? (
                      isExpanded
                        ? <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <TargetIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{node.okrTitle}</span>
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[node.okrStatus] ?? ""}`}>
                        {STATUS_LABEL[node.okrStatus] ?? node.okrStatus}
                      </span>
                      {node.themeTitle && (
                        <span
                          className="inline-flex rounded-full border px-1.5 py-0.5 text-xs font-medium"
                          style={node.themeColor ? {
                            background: `${node.themeColor}15`,
                            borderColor: `${node.themeColor}50`,
                            color: node.themeColor,
                          } : undefined}
                        >
                          {node.themeTitle}
                        </span>
                      )}
                      {!hasEpic && (
                        <span className="text-xs text-amber-600">⚠ Sem Epic</span>
                      )}
                    </div>
                    <div className="mt-1.5 max-w-xs">
                      <ProgressBar value={node.progress} />
                    </div>
                  </div>
                </button>

                {/* Epic + Features drill-down */}
                {isExpanded && hasEpic && (
                  <div className="border-t bg-muted/10 pl-10 pr-4 py-3">
                    <div className="flex items-start gap-2 mb-2">
                      <LayersIcon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{node.epicTitle}</span>
                          {node.epicStatus && (
                            <Badge variant="outline" className="text-xs uppercase">{node.epicStatus}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{node.featureCount} feature{node.featureCount !== 1 ? "s" : ""}</span>
                          <span className="text-green-600 font-medium">{node.featureDone} concluídas</span>
                          {node.featureCount > 0 && (
                            <span className="font-mono">
                              {Math.round((node.featureDone / node.featureCount) * 100)}% done
                            </span>
                          )}
                        </div>
                        {node.featureCount > 0 && (
                          <div className="mt-1.5 max-w-xs">
                            <ProgressBar value={node.featureCount > 0 ? Math.round((node.featureDone / node.featureCount) * 100) : 0} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
