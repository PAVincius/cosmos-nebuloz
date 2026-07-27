"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GitBranchIcon,
  LayersIcon,
  TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OKRTraceabilityNode } from "@/app/actions/okrs";

const STATUS_COLOR: Record<string, string> = {
  ON_TRACK: "bg-green-500/10 text-green-700 border-green-400/30",
  AT_RISK: "bg-amber-500/10 text-amber-700 border-amber-400/30",
  BEHIND: "bg-red-500/10 text-red-700 border-red-400/30",
  ACHIEVED: "bg-blue-500/10 text-blue-700 border-blue-400/30",
};

const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "No Prazo",
  AT_RISK: "Em Risco",
  BEHIND: "Atrasado",
  ACHIEVED: "Atingido",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${value >= 80 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-7 text-right font-mono text-muted-foreground text-xs">
        {value}%
      </span>
    </div>
  );
}

type Props = { nodes: OKRTraceabilityNode[] };

export function OKRTraceabilityView({ nodes }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [expandedOKRs, setExpandedOKRs] = useState<Set<string>>(new Set());

  const withEpic = nodes.filter((n) => n.epicId).length;
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
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            Rastreabilidade OKR → Epic → Features
          </span>
          <Badge className="text-xs" variant="outline">
            {nodes.length} OKRs
          </Badge>
          {withoutEpic > 0 && (
            <span className="font-medium text-amber-600 text-xs">
              {withoutEpic} sem Epic vinculado
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="divide-y border-t">
          {nodes.map((node) => {
            const isExpanded = expandedOKRs.has(node.okrId);
            const hasEpic = !!node.epicId;

            return (
              <div key={node.okrId}>
                {/* OKR row */}
                <button
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${hasEpic ? "cursor-pointer hover:bg-muted/20" : "cursor-default"}`}
                  onClick={() => hasEpic && toggleOKR(node.okrId)}
                  type="button"
                >
                  <div className="mt-0.5 shrink-0">
                    {hasEpic ? (
                      isExpanded ? (
                        <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      )
                    ) : (
                      <TargetIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">
                        {node.okrTitle}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-medium text-xs ${STATUS_COLOR[node.okrStatus] ?? ""}`}
                      >
                        {STATUS_LABEL[node.okrStatus] ?? node.okrStatus}
                      </span>
                      {node.themeTitle && (
                        <span
                          className="inline-flex rounded-full border px-1.5 py-0.5 font-medium text-xs"
                          style={
                            node.themeColor
                              ? {
                                  background: `${node.themeColor}15`,
                                  borderColor: `${node.themeColor}50`,
                                  color: node.themeColor,
                                }
                              : undefined
                          }
                        >
                          {node.themeTitle}
                        </span>
                      )}
                      {!hasEpic && (
                        <span className="text-amber-600 text-xs">
                          ⚠ Sem Epic
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 max-w-xs">
                      <ProgressBar value={node.progress} />
                    </div>
                  </div>
                </button>

                {/* Epic + Features drill-down */}
                {isExpanded && hasEpic && (
                  <div className="border-t bg-muted/10 py-3 pr-4 pl-10">
                    <div className="mb-2 flex items-start gap-2">
                      <LayersIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            className="font-medium text-sm underline-offset-2 hover:text-accent hover:underline"
                            href={`/epics/${node.epicId}`}
                          >
                            {node.epicTitle}
                          </Link>
                          {node.epicStatus && (
                            <Badge
                              className="text-xs uppercase"
                              variant="outline"
                            >
                              {node.epicStatus}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-muted-foreground text-xs">
                          <span>
                            {node.featureCount} feature
                            {node.featureCount !== 1 ? "s" : ""}
                          </span>
                          <span className="font-medium text-green-600">
                            {node.featureDone} concluídas
                          </span>
                          {node.featureCount > 0 && (
                            <span className="font-mono">
                              {Math.round(
                                (node.featureDone / node.featureCount) * 100
                              )}
                              % done
                            </span>
                          )}
                        </div>
                        {node.featureCount > 0 && (
                          <div className="mt-1.5 max-w-xs">
                            <ProgressBar
                              value={
                                node.featureCount > 0
                                  ? Math.round(
                                      (node.featureDone / node.featureCount) *
                                        100
                                    )
                                  : 0
                              }
                            />
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
