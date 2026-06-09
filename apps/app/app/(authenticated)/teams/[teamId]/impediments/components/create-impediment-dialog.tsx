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
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { createImpediment } from "@/app/actions/impediments";

type CreateImpedimentDialogProps = {
  teamId: string;
};

export function CreateImpedimentDialog({
  teamId,
}: CreateImpedimentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createImpediment({
          teamId,
          title: String(form.get("title")),
          description: String(form.get("description") || ""),
        });
        setOpen(false);
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "Erro ao criar impedimento."
        );
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo Impedimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Impedimento</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              maxLength={200}
              name="title"
              placeholder="Descreva o impedimento…"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              maxLength={5000}
              name="description"
              placeholder="Contexto e impacto do impedimento…"
            />
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
              {isPending ? "Registrando…" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
