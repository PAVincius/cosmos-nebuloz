"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../../../actions/suppliers";

// ─── Types ───────────────────────────────────────────────────────────────────

type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  artId: string | null;
  description: string | null;
  status: string;
};

type ART = {
  id: string;
  name: string;
};

// ─── Supplier Dialog ──────────────────────────────────────────────────────────

function SupplierDialog({
  supplier,
  arts,
  trigger,
  onSuccess,
}: {
  supplier?: Supplier;
  arts: ART[];
  trigger: React.ReactNode;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [artId, setArtId] = useState(supplier?.artId ?? "none");
  const [description, setDescription] = useState(supplier?.description ?? "");
  const [status, setStatus] = useState(supplier?.status ?? "ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const data = {
          name,
          contact: contact || undefined,
          artId: artId === "none" ? undefined : artId,
          description: description || undefined,
          status,
        };
        if (supplier) {
          await updateSupplier(supplier.id, data);
        } else {
          await createSupplier(data);
        }
        setOpen(false);
        if (!supplier) {
          setName("");
          setContact("");
          setArtId("none");
          setDescription("");
          setStatus("ACTIVE");
        }
        onSuccess();
      } catch {
        setError("Erro ao salvar fornecedor. Tente novamente.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sup-name"
              placeholder="ex: Accenture, IBM..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-contact">Contato</Label>
            <Input
              id="sup-contact"
              placeholder="ex: email, telefone..."
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>ART Vinculada</Label>
              <Select value={artId} onValueChange={setArtId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {arts.map((art) => (
                    <SelectItem key={art.id} value={art.id}>
                      {art.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="INACTIVE">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-description">Descrição</Label>
            <Textarea
              id="sup-description"
              placeholder="Descreva o escopo deste fornecedor..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? "Salvando..." : supplier ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function SuppliersBoard({
  initialSuppliers,
  arts,
}: {
  initialSuppliers: Supplier[];
  arts: ART[];
}) {
  const router = useRouter();
  const [filterArt, setFilterArt] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteSupplier(id);
      router.refresh();
    });
  }

  const filtered = initialSuppliers.filter((s) => {
    const artMatch = filterArt === "all" || s.artId === filterArt;
    const statusMatch = filterStatus === "all" || s.status === filterStatus;
    return artMatch && statusMatch;
  });

  const artMap = Object.fromEntries(arts.map((a) => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Select value={filterArt} onValueChange={setFilterArt}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar por ART" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ARTs</SelectItem>
              {arts.map((art) => (
                <SelectItem key={art.id} value={art.id}>
                  {art.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVE">Ativo</SelectItem>
              <SelectItem value="INACTIVE">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SupplierDialog
          arts={arts}
          trigger={
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              Novo Fornecedor
            </Button>
          }
          onSuccess={refresh}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <PackageIcon className="text-muted-foreground mb-4 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            Nenhum fornecedor encontrado.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>ART Vinculada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    {supplier.name}
                    {supplier.description && (
                      <p className="text-muted-foreground text-xs font-normal truncate max-w-xs">
                        {supplier.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {supplier.contact ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {supplier.artId ? (artMap[supplier.artId] ?? supplier.artId) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={supplier.status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {supplier.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <SupplierDialog
                        supplier={supplier}
                        arts={arts}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Button>
                        }
                        onSuccess={refresh}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(supplier.id)}
                        disabled={isPending}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
