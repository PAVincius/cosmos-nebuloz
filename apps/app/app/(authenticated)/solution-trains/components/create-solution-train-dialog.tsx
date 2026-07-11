"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import { createSolutionTrain } from "../../../actions/solution-trains";

// Re-skin of prototype's Solution Trains screen (screens-analytics.js:311).
// Prototype has no CTA for this screen ("Forms/CTA: nenhum") — this create
// flow is an apps/app addition; kept functionally intact, presentation
// aligned to the Cosmos ModalShell used by sibling create/edit modals.

export function CreateSolutionTrainDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setDescription("");
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Nome obrigatório");
      return;
    }
    startTransition(async () => {
      try {
        await createSolutionTrain({
          name: trimmed,
          description: description || undefined,
        });
        toast.success("Solution Train criado", { description: trimmed });
        setOpen(false);
        reset();
        router.refresh();
      } catch {
        toast.error("Erro ao criar Solution Train. Tente novamente.");
      }
    });
  }

  return (
    <>
      <Button className="gap-1.5" onClick={() => setOpen(true)} size="sm">
        <PlusIcon className="h-4 w-4" />
        Novo Solution Train
      </Button>

      <ModalShell
        eyebrow="Um Solution Train coordena múltiplos ARTs para entregar soluções de grande escala."
        footer={
          <>
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              disabled={isPending || !name.trim()}
              onClick={handleSubmit}
              type="button"
            >
              {isPending ? "Criando..." : "Criar Solution Train"}
            </Button>
          </>
        }
        onClose={() => setOpen(false)}
        open={open}
        size="md"
        title="Novo Solution Train"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-name">
              Nome <span className="text-rose-500">*</span>
            </Label>
            <Input
              autoFocus
              id="st-name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
              placeholder="ex: Plataforma de Pagamentos..."
              value={name}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-description">Descrição</Label>
            <Textarea
              id="st-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva o propósito deste Solution Train..."
              rows={3}
              value={description}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
