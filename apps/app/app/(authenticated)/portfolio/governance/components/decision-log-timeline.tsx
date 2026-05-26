type Entry = {
  id: string;
  decisao: string;
  justificativa: string;
  tipo: string;
  decisorId: string;
  dataDecisao?: Date | string | null;
  createdAt?: Date | string | null;
};

type Props = { entries: Entry[] };

export function DecisionLogTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma decisão registrada.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-muted pl-4 space-y-4">
      {entries.map((e) => {
        const ts = e.dataDecisao ?? e.createdAt;
        const date = ts
          ? new Date(ts as string).toLocaleDateString("pt-BR")
          : "—";
        return (
          <li key={e.id} className="text-sm">
            <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-muted bg-background" />
            <time className="text-xs text-muted-foreground">{date}</time>
            <p className="font-medium">{e.decisao}</p>
            <p className="text-xs text-muted-foreground">{e.justificativa}</p>
          </li>
        );
      })}
    </ol>
  );
}
