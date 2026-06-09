"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  FlameIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ImpedimentWithTeam } from "@/app/actions/impediments";
import { resolveImpediment } from "@/app/actions/impediments";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  OPEN: { label: "Aberto", icon: AlertTriangleIcon, color: "text-red-500" },
  IN_PROGRESS: {
    label: "Em Andamento",
    icon: ClockIcon,
    color: "text-blue-500",
  },
  RESOLVED: {
    label: "Resolvido",
    icon: CheckCircle2Icon,
    color: "text-green-500",
  },
};

const STATUS_BADGE: Record<string, "destructive" | "default" | "outline"> = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  RESOLVED: "outline",
};

function AgePill({ days, escalated }: { days: number; escalated: boolean }) {
  if (escalated) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-red-400/30 bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-600 text-xs">
        <FlameIcon className="h-2.5 w-2.5" /> {days}d
      </span>
    );
  }
  if (days > 7) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 text-xs">
        {days}d
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">{days}d</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  impediments: ImpedimentWithTeam[];
};

export function ImpedimentARTDashboard({ impediments }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterTeam, setFilterTeam] = useState("ALL");

  const teams = Array.from(
    new Set(
      impediments.map((i) => i.teamName).filter((n): n is string => n !== null)
    )
  ).sort();

  const filtered = impediments.filter((i) => {
    if (filterStatus !== "ALL" && i.status !== filterStatus) {
      return false;
    }
    if (filterTeam !== "ALL" && i.teamName !== filterTeam) {
      return false;
    }
    return true;
  });

  const byTeam = teams
    .map((team) => {
      const items = impediments.filter((i) => i.teamName === team);
      return {
        team,
        open: items.filter((i) => i.status === "OPEN").length,
        inProgress: items.filter((i) => i.status === "IN_PROGRESS").length,
        escalated: items.filter((i) => i.isEscalated).length,
        total: items.length,
      };
    })
    .sort((a, b) => b.escalated - a.escalated || b.open - a.open);

  function handleResolve(id: string) {
    startTransition(async () => {
      const result = await resolveImpediment(id);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Team breakdown */}
      {byTeam.length > 0 && (
        <div>
          <p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Por Time
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {byTeam.map((t) => (
              <div
                className={`rounded-lg border p-3 ${t.escalated > 0 ? "border-red-300 dark:border-red-800" : ""}`}
                key={t.team}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="truncate font-medium text-xs">{t.team}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-red-500">
                    {t.open} abertos
                  </span>
                  {t.escalated > 0 && (
                    <span className="flex items-center gap-0.5 font-bold text-red-600">
                      <FlameIcon className="h-2.5 w-2.5" />
                      {t.escalated} escal.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select onValueChange={setFilterStatus} value={filterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="OPEN">Aberto</SelectItem>
            <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
            <SelectItem value="RESOLVED">Resolvido</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={setFilterTeam} value={filterTeam}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os times</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-muted-foreground text-xs">
          {filtered.length} impedimento(s)
        </span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
          <CheckCircle2Icon className="mb-2 h-8 w-8 text-green-400" />
          <p className="font-medium text-sm">Sem impedimentos nesse filtro</p>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Ótimo sinal de saúde do ART.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((imp) => {
            const cfg = STATUS_CONFIG[imp.status] ?? STATUS_CONFIG.OPEN;
            const Icon = cfg.icon;
            return (
              <div
                className={`flex items-start gap-4 px-4 py-3 ${imp.isEscalated ? "bg-red-500/5" : ""}`}
                key={imp.id}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-medium text-sm ${imp.isEscalated ? "text-red-600" : ""}`}
                    >
                      {imp.title}
                    </span>
                    {imp.isEscalated && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-red-400/30 bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-600 text-xs">
                        <FlameIcon className="h-2.5 w-2.5" /> Escalado
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {imp.teamName && (
                      <span className="text-muted-foreground text-xs">
                        {imp.teamName}
                      </span>
                    )}
                    <AgePill days={imp.ageDays} escalated={imp.isEscalated} />
                    <Badge
                      className="h-4 text-xs"
                      variant={STATUS_BADGE[imp.status] ?? "outline"}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                  {imp.description && (
                    <p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                      {imp.description}
                    </p>
                  )}
                </div>
                {imp.status !== "RESOLVED" && (
                  <Button
                    className="h-7 shrink-0 text-xs"
                    disabled={isPending}
                    onClick={() => handleResolve(imp.id)}
                    size="sm"
                    variant="outline"
                  >
                    Resolver
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
