import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";
import { FlowStalenessBadge } from "./flow-staleness-badge";

type Props = {
  title: string;
  staleness?: "FRESH" | "AGING" | "STALE" | "CRITICAL" | null;
  children: ReactNode;
};

export function FlowMetricCard({ title, staleness, children }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-medium text-sm">{title}</CardTitle>
          <FlowStalenessBadge staleness={staleness ?? null} />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
