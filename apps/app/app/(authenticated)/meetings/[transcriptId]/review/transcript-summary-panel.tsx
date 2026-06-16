type RawSummary = {
  overview?: string;
  action_items?: string[];
  keywords?: string[];
  outline?: Array<{
    speaker?: string;
    summary?: string;
    topic?: string;
    text?: string;
  }>;
};

type Props = { rawSummary: unknown };

export function TranscriptSummaryPanel({ rawSummary }: Props) {
  if (!rawSummary || typeof rawSummary !== "object") {
    return null;
  }

  const summary = rawSummary as RawSummary;
  const hasOverview = Boolean(summary.overview);
  const hasOutline =
    Array.isArray(summary.outline) && summary.outline.length > 0;
  const hasKeywords =
    Array.isArray(summary.keywords) && summary.keywords.length > 0;

  if (!(hasOverview || hasOutline || hasKeywords)) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4 text-sm">
      {hasOverview && (
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Resumo
          </p>
          <p className="text-sm leading-relaxed">{summary.overview}</p>
        </div>
      )}

      {hasOutline && (
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Segmentos por Speaker
          </p>
          <ul className="space-y-3">
            {(summary.outline ?? []).map((segment, i) => (
              <li className="flex gap-3" key={i}>
                {segment.speaker && (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-semibold text-[10px] text-primary">
                    {segment.speaker.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="space-y-0.5">
                  {segment.speaker && (
                    <p className="font-medium text-xs">{segment.speaker}</p>
                  )}
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {segment.summary ?? segment.text ?? segment.topic ?? ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasKeywords && (
        <div className="space-y-1.5">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Palavras-chave
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(summary.keywords ?? []).map((kw) => (
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                key={kw}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
