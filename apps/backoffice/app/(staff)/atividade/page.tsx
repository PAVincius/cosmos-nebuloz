import { listStaffActivity } from "@/app/actions/clients";

export default async function ActivityPage() {
  const result = await listStaffActivity();

  if (!result.ok) {
    return (
      <p className="text-destructive" role="alert">
        {result.error}
      </p>
    );
  }

  if (result.data.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="font-medium">Nada registrado ainda</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Contratações e provisionamentos aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-2xl">Atividade</h1>
      <ul className="space-y-2 text-sm">
        {result.data.map((row) => (
          <li className="border-b pb-2" key={row.id}>
            <span className="font-medium">{row.action}</span> · {row.target}
            <span className="block text-muted-foreground text-xs">
              {row.actorName ?? "—"} ·{" "}
              {new Date(row.createdAt).toLocaleString("pt-BR")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
