"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { AnchorIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSolutionTrain } from "../../../actions/solution-trains";

export function CreateSolutionTrainDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await createSolutionTrain({
          name,
          description: description || undefined,
        });
        setOpen(false);
        setName("");
        setDescription("");
        router.refresh();
      } catch {
        setError("Erro ao criar Solution Train. Tente novamente.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo Solution Train
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <AnchorIcon className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Novo Solution Train</DialogTitle>
          </div>
          <DialogDescription>
            Um Solution Train coordena múltiplos ARTs para entregar soluções de
            grande escala.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="st-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              id="st-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="ex: Plataforma de Pagamentos..."
              value={name}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="st-description">Descrição</Label>
            <Textarea
              id="st-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito deste Solution Train..."
              rows={3}
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
            {isPending ? "Criando..." : "Criar Solution Train"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
