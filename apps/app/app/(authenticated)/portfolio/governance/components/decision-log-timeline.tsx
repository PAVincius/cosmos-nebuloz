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
      <p className="text-muted-foreground text-xs">
        Nenhuma decisão registrada.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-muted border-l pl-4">
      {entries.map((e) => {
        const ts = e.dataDecisao ?? e.createdAt;
        const date = ts
          ? new Date(ts as string).toLocaleDateString("pt-BR")
          : "—";
        return (
          <li className="text-sm" key={e.id}>
            <span className="-left-1.5 absolute mt-1 h-3 w-3 rounded-full border border-muted bg-background" />
            <time className="text-muted-foreground text-xs">{date}</time>
            <p className="font-medium">{e.decisao}</p>
            <p className="text-muted-foreground text-xs">{e.justificativa}</p>
          </li>
        );
      })}
    </ol>
  );
}
