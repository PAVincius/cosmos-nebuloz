import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import Link from "next/link";
import { listClients } from "./actions/clients";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> =
  {
    ACTIVE: "default",
    TRIAL: "secondary",
    SUSPENDED: "destructive",
    CANCELED: "destructive",
  };

export default async function ClientsPage() {
  const result = await listClients();

  if (!result.ok) {
    return <p className="text-destructive">{result.error}</p>;
  }

  if (result.data.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="font-medium">Nenhum cliente ainda</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Provisione o primeiro em{" "}
          <Link href="/clientes/novo">novo cliente</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-2xl">Clientes</h1>
        <Link className="text-sm underline" href="/clientes/novo">
          Novo cliente
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Membros</TableHead>
            <TableHead>Módulos</TableHead>
            <TableHead>Desde</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.data.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link className="font-medium" href={`/clientes/${client.slug}`}>
                  {client.name}
                </Link>
                <span className="block text-muted-foreground text-xs">
                  {client.slug}
                </span>
              </TableCell>
              <TableCell>{client.memberCount}</TableCell>
              <TableCell className="space-x-1">
                {client.modules.length === 0 ? (
                  <span className="text-muted-foreground text-xs">nenhum</span>
                ) : (
                  client.modules.map((m) => (
                    <Badge
                      key={m.module}
                      variant={STATUS_VARIANT[m.status] ?? "secondary"}
                    >
                      {m.module}
                    </Badge>
                  ))
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(client.createdAt).toLocaleDateString("pt-BR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
