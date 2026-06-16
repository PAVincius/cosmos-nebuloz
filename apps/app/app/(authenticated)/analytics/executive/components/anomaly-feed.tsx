"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import type { AnomalyFeedItem } from "@/lib/analytics/executive-dashboard";

type Props = {
  items: AnomalyFeedItem[];
};

const SEV_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CRITICAL: "destructive",
  HIGH: "secondary",
  MEDIUM: "outline",
  LOW: "default",
};

export function AnomalyFeed({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground text-sm">
        No open anomalies.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li className="flex items-center gap-3 py-3" key={item.id}>
          <Badge
            className="shrink-0"
            variant={SEV_VARIANT[item.severity] ?? "outline"}
          >
            {item.severity}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{item.rule}</p>
            <p className="text-muted-foreground text-xs">
              {item.metric}
              {item.entityType ? ` · ${item.entityType}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-muted-foreground text-xs">
            {item.detectedAt.toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
