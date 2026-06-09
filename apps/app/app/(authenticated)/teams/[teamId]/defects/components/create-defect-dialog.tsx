"use client";

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
import { useState, useTransition } from "react";
import { createDefect } from "@/app/actions/defects";

type CreateDefectDialogProps = {
  teamId: string;
};

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
    <Dialog onOpenChange={setOpen} open={open}>
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
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              maxLength={200}
              name="title"
              placeholder="Descreva o defeito…"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              maxLength={5000}
              name="description"
              placeholder="Passos para reproduzir, comportamento esperado…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Severidade</Label>
            <Select onValueChange={setSeverity} value={severity}>
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
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending ? "Registrando…" : "Registrar Defect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
