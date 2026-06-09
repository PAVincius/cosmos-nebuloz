"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { PackageIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSupplier,
  deleteSupplier,
  updateSupplier,
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
    <Dialog onOpenChange={setOpen} open={open}>
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
              autoFocus
              id="sup-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Accenture, IBM..."
              value={name}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-contact">Contato</Label>
            <Input
              id="sup-contact"
              onChange={(e) => setContact(e.target.value)}
              placeholder="ex: email, telefone..."
              value={contact}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>ART Vinculada</Label>
              <Select onValueChange={setArtId} value={artId}>
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
              <Select onValueChange={setStatus} value={status}>
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o escopo deste fornecedor..."
              rows={2}
              value={description}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => setOpen(false)}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button disabled={isPending || !name.trim()} onClick={handleSubmit}>
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
          <Select onValueChange={setFilterArt} value={filterArt}>
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

          <Select onValueChange={setFilterStatus} value={filterStatus}>
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
          onSuccess={refresh}
          trigger={
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              Novo Fornecedor
            </Button>
          }
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <PackageIcon className="mb-4 h-10 w-10 text-muted-foreground" />
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
                      <p className="max-w-xs truncate font-normal text-muted-foreground text-xs">
                        {supplier.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {supplier.contact ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {supplier.artId
                      ? (artMap[supplier.artId] ?? supplier.artId)
                      : "—"}
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
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <SupplierDialog
                        arts={arts}
                        onSuccess={refresh}
                        supplier={supplier}
                        trigger={
                          <Button
                            className="h-8 w-8"
                            size="icon"
                            variant="ghost"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={isPending}
                        onClick={() => handleDelete(supplier.id)}
                        size="icon"
                        variant="ghost"
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
