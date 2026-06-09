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
import { createSprint } from "@/app/actions/sprints";

type CreateSprintDialogProps = {
  teamId: string;
};

export function CreateSprintDialog({ teamId }: CreateSprintDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createSprint({
        teamId,
        name: String(form.get("name")),
        goal: String(form.get("goal") || ""),
        startDate: new Date(String(form.get("startDate"))),
        endDate: new Date(String(form.get("endDate"))),
        capacity: form.get("capacity")
          ? Number(form.get("capacity"))
          : undefined,
      });
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo Sprint
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Sprint</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome do Sprint *</Label>
            <Input
              id="name"
              maxLength={200}
              name="name"
              placeholder="Sprint 1"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal">Objetivo</Label>
            <Input
              id="goal"
              maxLength={500}
              name="goal"
              placeholder="Meta do sprint…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Início *</Label>
              <Input id="startDate" name="startDate" required type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">Fim *</Label>
              <Input id="endDate" name="endDate" required type="date" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capacity">Capacidade (SP)</Label>
            <Input
              id="capacity"
              max={500}
              min={1}
              name="capacity"
              placeholder="Ex: 40"
              type="number"
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
              {isPending ? "Criando…" : "Criar Sprint"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
