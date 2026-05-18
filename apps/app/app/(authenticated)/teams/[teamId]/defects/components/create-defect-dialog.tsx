"use client";

import { useTransition, useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { PlusIcon } from "lucide-react";
import { createDefect } from "@/app/actions/defects";

interface CreateDefectDialogProps {
  teamId: string;
}

export function CreateDefectDialog({ teamId }: CreateDefectDialogProps) {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState("medium");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createDefect({
          teamId,
          title: String(form.get("title")),
          description: String(form.get("description") || ""),
          severity,
        });
        setOpen(false);
        setSeverity("medium");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao criar defect.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo Defect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Defect</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" name="title" placeholder="Descreva o defeito…" required maxLength={200} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" placeholder="Passos para reproduzir, comportamento esperado…" maxLength={5000} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Severidade</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="low">Baixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando…" : "Registrar Defect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
