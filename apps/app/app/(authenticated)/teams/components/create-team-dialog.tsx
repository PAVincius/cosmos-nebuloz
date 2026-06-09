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
import { PlusIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTeam } from "../actions";

type Art = { id: string; name: string };

export function CreateTeamDialog({ arts }: { arts: Art[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [artId, setArtId] = useState<string>("none");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createTeam({
          name: name.trim(),
          artId: artId === "none" ? null : artId,
        });
        setOpen(false);
        setName("");
        setArtId("none");
        router.refresh();
      } catch {
        setError("Erro ao criar time. Tente novamente.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo Time
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UsersIcon className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Novo Time Ágil</DialogTitle>
          </div>
          <DialogDescription>
            Times são equipes Scrum ou Kanban alinhadas a um ART. Configure
            membros e capacidade após a criação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">
              Nome do time <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              id="team-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="ex: Team Phoenix, Plataforma Core..."
              value={name}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="team-art">ART vinculado</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm shadow-sm"
              id="team-art"
              onChange={(e) => setArtId(e.target.value)}
              value={artId}
            >
              <option value="none">Sem ART (time independente)</option>
              {arts.map((art) => (
                <option key={art.id} value={art.id}>
                  {art.name}
                </option>
              ))}
            </select>
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
            {isPending ? "Criando..." : "Criar Time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
