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
import { PackageIcon } from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  artId: string | null;
  description: string | null;
  status: string;
};

export function SuppliersTab({
  initialSuppliers,
}: {
  initialSuppliers: Supplier[];
}) {
  if (initialSuppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <PackageIcon className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Nenhum fornecedor registrado.
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Gerencie fornecedores na página{" "}
          <a className="underline underline-offset-2" href="/suppliers">
            Fornecedores
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>ART</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialSuppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {supplier.contact ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {supplier.artId ?? "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    supplier.status === "ACTIVE" ? "default" : "secondary"
                  }
                >
                  {supplier.status === "ACTIVE" ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
