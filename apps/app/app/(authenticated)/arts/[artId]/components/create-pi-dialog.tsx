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
import { CalendarIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPIPlan } from "../../../../actions/arts/pi-plans";

type CreatePIDialogProps = {
  artId: string;
  artName: string;
  cadence: number;
  nextPINumber: number;
};

export function CreatePIDialog({
  artId,
  artName,
  cadence,
  nextPINumber,
}: CreatePIDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`PI ${nextPINumber}`);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (value && cadence) {
      const start = new Date(value);
      const end = new Date(start);
      end.setDate(end.getDate() + cadence * 7);
      setEndDate(end.toISOString().split("T")[0]);
    }
  }

  const durationDays =
    startDate && endDate
      ? Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const sprintCount = durationDays ? Math.floor(durationDays / 14) : null;

  function handleSubmit() {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      setError("Data de término deve ser posterior à data de início");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createPIPlan({
          artId,
          name: name.trim(),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        setOpen(false);
        setName(`PI ${nextPINumber + 1}`);
        setStartDate("");
        setEndDate("");
        router.refresh();
      } catch {
        setError("Erro ao criar PI. Tente novamente.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo PI
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Novo Program Increment</DialogTitle>
              <p className="mt-0.5 text-muted-foreground text-xs">{artName}</p>
            </div>
          </div>
          <DialogDescription>
            Um PI é um bloco de tempo de {cadence} semanas onde o ART planeja e
            entrega valor incremental.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pi-name">
                Nome do PI <span className="text-destructive">*</span>
              </Label>
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <SparklesIcon className="h-3 w-3" />
                Sugerido automaticamente
              </span>
            </div>
            <Input
              autoFocus
              id="pi-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: PI 1, PI 2024-Q1..."
              value={name}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pi-start">Início</Label>
              <Input
                id="pi-start"
                onChange={(e) => handleStartDateChange(e.target.value)}
                type="date"
                value={startDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pi-end">Término</Label>
              <Input
                id="pi-end"
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                type="date"
                value={endDate}
              />
            </div>
          </div>

          {durationDays !== null && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="font-semibold text-lg">{durationDays}</p>
                  <p className="text-muted-foreground text-xs">dias</p>
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {Math.round(durationDays / 7)}
                  </p>
                  <p className="text-muted-foreground text-xs">semanas</p>
                </div>
                <div>
                  <p className="font-semibold text-lg">{sprintCount}</p>
                  <p className="text-muted-foreground text-xs">sprints</p>
                </div>
              </div>
            </div>
          )}

          {!startDate && (
            <p className="text-center text-muted-foreground text-xs">
              Datas são opcionais — podem ser definidas depois.
            </p>
          )}

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
            {isPending ? "Criando..." : "Criar PI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
