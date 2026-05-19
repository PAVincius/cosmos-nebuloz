"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import {
  applySuggestion,
  createCopilotSuggestion,
  discardSuggestion,
} from "@/app/actions/safe-copilot";

const SUGGESTION_LABELS: Record<string, string> = {
  create_risks: "Criar Riscos",
  create_pi_objectives: "Criar Objetivos de PI",
  flag_dependencies: "Sinalizar Dependências",
  create_improvement_action: "Criar Ações de Melhoria",
};

export type ParsedSuggestion = {
  type: string;
  payload: unknown;
};

export function parseSuggestions(content: string): ParsedSuggestion[] {
  const regex = /<suggestion\s+type="([^"]+)">\s*([\s\S]*?)\s*<\/suggestion>/g;
  const results: ParsedSuggestion[] = [];
  let match: RegExpExecArray | null = regex.exec(content);
  while (match !== null) {
    try {
      results.push({ type: match[1], payload: JSON.parse(match[2]) });
    } catch {
      // skip malformed suggestion blocks
    }
    match = regex.exec(content);
  }
  return results;
}

type SuggestionCardProps = {
  sessionId: string;
  suggestion: ParsedSuggestion;
};

function SuggestionCard({ sessionId, suggestion }: SuggestionCardProps) {
  const [status, setStatus] = useState<"idle" | "applied" | "discarded">(
    "idle"
  );
  const [isPending, startTransition] = useTransition();

  const label = SUGGESTION_LABELS[suggestion.type] ?? suggestion.type;
  const items = (suggestion.payload as { items?: unknown[] })?.items ?? [];

  if (status !== "idle") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
        {status === "applied" ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        <span>{status === "applied" ? `${label} aplicado` : "Descartado"}</span>
      </div>
    );
  }

  const validType = suggestion.type as
    | "create_pi_objectives"
    | "create_risks"
    | "flag_dependencies"
    | "create_improvement_action";

  const handleApply = () => {
    startTransition(async () => {
      const created = await createCopilotSuggestion(
        sessionId,
        validType,
        suggestion.payload
      );
      await applySuggestion(created.id);
      setStatus("applied");
    });
  };

  const handleDiscard = () => {
    startTransition(async () => {
      const created = await createCopilotSuggestion(
        sessionId,
        validType,
        suggestion.payload
      );
      await discardSuggestion(created.id);
      setStatus("discarded");
    });
  };

  return (
    <div className="mt-2 rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-foreground text-xs">{label}</span>
        <span className="text-muted-foreground text-xs">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>
      {items.slice(0, 3).map((item, i) => {
        const title =
          (item as { title?: string })?.title ??
          JSON.stringify(item).slice(0, 60);
        return (
          <div
            className="mb-1 truncate text-muted-foreground text-xs"
            key={`item-${i}-${title.slice(0, 20)}`}
          >
            • {title}
          </div>
        );
      })}
      {items.length > 3 ? (
        <div className="mb-2 text-muted-foreground text-xs">
          +{items.length - 3} mais...
        </div>
      ) : null}
      <div className="mt-2 flex gap-2">
        <Button
          className="h-7 text-xs"
          disabled={isPending}
          onClick={handleApply}
          size="sm"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle className="mr-1 h-3 w-3" />
          )}
          Aplicar
        </Button>
        <Button
          className="h-7 text-xs"
          disabled={isPending}
          onClick={handleDiscard}
          size="sm"
          variant="ghost"
        >
          Descartar
        </Button>
      </div>
    </div>
  );
}

type CopilotSuggestionsProps = {
  sessionId: string;
  content: string;
};

export function CopilotSuggestions({
  sessionId,
  content,
}: CopilotSuggestionsProps) {
  const suggestions = parseSuggestions(content);
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {suggestions.map((s) => (
        <SuggestionCard
          key={`${s.type}-${String(JSON.stringify(s.payload)).slice(0, 30)}`}
          sessionId={sessionId}
          suggestion={s}
        />
      ))}
    </div>
  );
}
