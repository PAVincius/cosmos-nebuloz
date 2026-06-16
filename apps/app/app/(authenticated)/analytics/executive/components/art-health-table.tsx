"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import type { ARTRow } from "@/lib/analytics/executive-dashboard";

type Props = {
  rows: ARTRow[];
};

const HEALTH_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  healthy: "default",
  warning: "secondary",
  critical: "destructive",
};

export function ArtHealthTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">
        No active ARTs found.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ART</TableHead>
          <TableHead className="text-right">Predictability</TableHead>
          <TableHead className="text-right">Critical Anomalies</TableHead>
          <TableHead>Health</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.artId}>
            <TableCell className="font-medium">{r.artName}</TableCell>
            <TableCell className="text-right tabular-nums">
              {r.predictabilityPct}%
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.criticalAnomalies}
            </TableCell>
            <TableCell>
              <Badge variant={HEALTH_VARIANT[r.health] ?? "outline"}>
                {r.health}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
