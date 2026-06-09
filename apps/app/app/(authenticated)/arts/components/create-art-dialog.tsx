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
import { InfoIcon, PlusIcon, TrainFrontIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createART } from "../../../actions/arts/get-arts";

const CADENCE_PRESETS = [
  { label: "8w", value: 8, desc: "Acelerado" },
  { label: "10w", value: 10, desc: "SAFe padrão" },
  { label: "12w", value: 12, desc: "Conservador" },
];

export function CreateARTDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState(10);
  const [customCadence, setCustomCadence] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const effectiveCadence = customCadence
    ? Number.parseInt(customCadence, 10)
    : cadence;

  function handleSubmit() {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    if (
      Number.isNaN(effectiveCadence) ||
      effectiveCadence < 4 ||
      effectiveCadence > 26
    ) {
      setError("Cadência deve estar entre 4 e 26 semanas");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createART({ name: name.trim(), cadence: effectiveCadence });
        setOpen(false);
        setName("");
        setCadence(10);
        setCustomCadence("");
        router.refresh();
      } catch {
        setError("Erro ao criar ART. Tente novamente.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo ART
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrainFrontIcon className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Novo Agile Release Train</DialogTitle>
          </div>
          <DialogDescription>
            Um ART é uma equipe de times que entrega valor em cadência regular
            através de Program Increments.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="art-name">
              Nome do ART <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              id="art-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="ex: Plataforma Digital, Core Banking..."
              value={name}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Cadência do PI</Label>
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <InfoIcon className="h-3 w-3" />
                Semanas por Program Increment
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {CADENCE_PRESETS.map((preset) => (
                <button
                  className={`flex flex-col items-center rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    cadence === preset.value && !customCadence
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                  key={preset.value}
                  onClick={() => {
                    setCadence(preset.value);
                    setCustomCadence("");
                  }}
                  type="button"
                >
                  <span className="font-semibold">{preset.label}</span>
                  <span className="mt-0.5 text-muted-foreground text-xs">
                    {preset.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-muted-foreground text-xs">
                ou personalizado
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex items-center gap-2">
              <Input
                className="w-28 text-center"
                max={26}
                min={4}
                onChange={(e) => {
                  setCustomCadence(e.target.value);
                  setCadence(0);
                }}
                placeholder="ex: 14"
                type="number"
                value={customCadence}
              />
              <span className="text-muted-foreground text-sm">
                semanas (4–26)
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <span className="font-medium">Resumo: </span>
            <span className="text-muted-foreground">
              {name.trim() || "Este ART"} terá PIs de{" "}
              <strong>
                {Number.isNaN(effectiveCadence) ? "—" : effectiveCadence}{" "}
                semanas
              </strong>
              , com{" "}
              {Number.isNaN(effectiveCadence)
                ? "—"
                : Math.floor(effectiveCadence / 2)}{" "}
              sprints de 2 semanas por PI.
            </span>
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
            {isPending ? "Criando..." : "Criar ART"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
