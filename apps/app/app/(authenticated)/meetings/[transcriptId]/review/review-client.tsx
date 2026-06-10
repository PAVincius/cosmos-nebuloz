"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState, useTransition } from "react";
import {
  applyInsight,
  dismissInsight,
  type InsightRow,
} from "@/app/actions/meeting/insights";

const TYPE_LABEL: Record<string, string> = {
  ACTION: "Ação",
  RISK: "Risco",
  DECISION: "Decisão",
};

const TYPE_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTION: "default",
  RISK: "destructive",
  DECISION: "secondary",
};

type InsightCardProps = {
  row: InsightRow;
  onUpdate: (id: string, status: string) => void;
};

function InsightCard({ row, onUpdate }: InsightCardProps) {
  const [text, setText] = useState(row.text);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const res = await applyInsight({
        insightId: row.id,
        text: text !== row.text ? text : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onUpdate(row.id, "APPLIED");
    });
  }

  function handleDismiss() {
    setError(null);
    startTransition(async () => {
      const res = await dismissInsight({ insightId: row.id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onUpdate(row.id, "DISMISSED");
    });
  }

  const isDone = row.status !== "PENDING";

  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Badge variant={TYPE_VARIANT[row.type] ?? "outline"}>
          {TYPE_LABEL[row.type] ?? row.type}
        </Badge>
        {isDone && (
          <Badge className="text-muted-foreground" variant="outline">
            {row.status === "APPLIED" ? "Aplicado" : "Descartado"}
          </Badge>
        )}
      </div>
      <Textarea
        className="min-h-[80px] text-sm"
        disabled={isDone || pending}
        onChange={(e) => setText(e.target.value)}
        value={text}
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {!isDone && (
        <div className="flex gap-2">
          <Button
            disabled={pending || text.trim().length === 0}
            onClick={handleApply}
            size="sm"
            type="button"
          >
            {pending ? "A processar…" : "Aprovar"}
          </Button>
          <Button
            disabled={pending}
            onClick={handleDismiss}
            size="sm"
            type="button"
            variant="outline"
          >
            Descartar
          </Button>
        </div>
      )}
    </li>
  );
}

type Props = {
  initial: InsightRow[];
  transcriptTitle: string | null;
};

export function ReviewClient({ initial, transcriptTitle }: Props) {
  const [insights, setInsights] = useState(initial);

  function handleUpdate(id: string, status: string) {
    setInsights((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  }

  const pending = insights.filter((r) => r.status === "PENDING").length;
  const applied = insights.filter((r) => r.status === "APPLIED").length;
  const dismissed = insights.filter((r) => r.status === "DISMISSED").length;

  return (
    <div className="space-y-4">
      {transcriptTitle && <h2 className="font-medium">{transcriptTitle}</h2>}
      <div className="flex gap-4 text-muted-foreground text-sm">
        <span>{pending} pendente(s)</span>
        <span>{applied} aplicado(s)</span>
        <span>{dismissed} descartado(s)</span>
      </div>
      {insights.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum insight extraído desta transcrição.
        </p>
      ) : (
        <ul className="space-y-3">
          {insights.map((row) => (
            <InsightCard key={row.id} onUpdate={handleUpdate} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
