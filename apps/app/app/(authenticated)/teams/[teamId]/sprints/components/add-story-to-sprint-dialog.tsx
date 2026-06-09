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
import { createStory } from "@/app/actions/stories";

type AddStoryToSprintDialogProps = {
  sprintId: string;
  teamId: string;
};

export function AddStoryToSprintDialog({
  sprintId,
  teamId,
}: AddStoryToSprintDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [priority, setPriority] = useState("medium");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createStory({
        sprintId,
        title: String(form.get("title")),
        storyPoints: form.get("storyPoints")
          ? Number(form.get("storyPoints"))
          : 1,
        priority,
        status: "BACKLOG",
      });
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setOpen(false);
      setPriority("medium");
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Nova Story
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Story ao Sprint</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              maxLength={255}
              name="title"
              placeholder="Como usuário, quero..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="storyPoints">Story Points</Label>
              <Input
                defaultValue={1}
                id="storyPoints"
                max={100}
                min={0}
                name="storyPoints"
                placeholder="1"
                type="number"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Prioridade</Label>
              <Select onValueChange={setPriority} value={priority}>
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending ? "Criando..." : "Criar Story"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
