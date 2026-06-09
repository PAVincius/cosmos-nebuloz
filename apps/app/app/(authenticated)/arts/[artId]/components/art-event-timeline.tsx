"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { MonitorIcon, PlayCircleIcon, RefreshCwIcon } from "lucide-react";
import type { ARTEvent } from "@/app/actions/arts/observability";

const EVENT_CONFIG = {
  pi_planning: {
    icon: PlayCircleIcon,
    label: "PI Planning",
  },
  system_demo: {
    icon: MonitorIcon,
    label: "System Demo",
  },
  inspect_adapt: {
    icon: RefreshCwIcon,
    label: "Inspect & Adapt",
  },
} as const;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

type ARTEventTimelineProps = {
  events: ARTEvent[];
};

export function ARTEventTimeline({ events }: ARTEventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-muted-foreground text-sm">
        Nenhum PI configurado — crie um PI para ver a timeline.
      </div>
    );
  }

  // Server action returns events sorted — defensive copy for slice safety
  const ordered = events;
  const currentIdx = ordered.findIndex((e) => e.status !== "past");
  const startIdx = Math.max(
    0,
    currentIdx === -1 ? ordered.length - 3 : currentIdx - 3
  );
  const visible = ordered.slice(startIdx, startIdx + 10);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-[19px] w-px bg-border/60"
      />
      <div className="flex flex-col gap-4">
        {visible.map((event) => {
          const config =
            EVENT_CONFIG[event.type as keyof typeof EVENT_CONFIG] ??
            EVENT_CONFIG.pi_planning;
          const Icon = config.icon;
          const isPast = event.status === "past";
          const isCurrent = event.status === "current";

          return (
            <div className="flex items-start gap-3" key={event.id}>
              <div
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isCurrent
                    ? "border-[#5e6ad2] bg-[#5e6ad2] text-white"
                    : isPast
                      ? "border-border/60 bg-muted text-muted-foreground"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div
                className={`flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 ${
                  isCurrent
                    ? "border-[#5e6ad2]/40 bg-[#5e6ad2]/5"
                    : isPast
                      ? "border-border/50 bg-muted/20"
                      : "border-border/80 bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-medium text-sm ${
                      isPast ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {event.label}
                  </span>
                  {isCurrent && (
                    <Badge className="bg-[#5e6ad2] text-xs" variant="default">
                      Atual
                    </Badge>
                  )}
                </div>
                <span className="mt-0.5 text-muted-foreground text-xs tabular-nums">
                  {formatDate(event.date)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {ordered.length > 10 && (
        <p className="mt-3 text-center text-muted-foreground text-xs">
          Mostrando 10 de {ordered.length} eventos
        </p>
      )}
    </div>
  );
}
