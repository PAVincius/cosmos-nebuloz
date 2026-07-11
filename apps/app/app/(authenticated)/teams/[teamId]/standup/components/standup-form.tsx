"use client";

import { CosmosHeader } from "@repo/design-system/components/cosmos";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { AlertTriangleIcon, CheckIcon, MicIcon, SendIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { createImpediment } from "@/app/actions/impediments";
import { upsertStandupEntry } from "@/app/actions/standup";

type StandupFormProps = {
  teamId: string;
  todayIso: string; // "YYYY-MM-DD"
  existing?: {
    yesterday?: string | null;
    today?: string | null;
    blockers?: string | null;
  };
};

export function StandupForm({ teamId, todayIso, existing }: StandupFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreatingImpediment, startImpedimentTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [impedimentCreated, setImpedimentCreated] = useState(false);

  const [yesterday, setYesterday] = useState(existing?.yesterday ?? "");
  const [today, setToday] = useState(existing?.today ?? "");
  const [blockers, setBlockers] = useState(existing?.blockers ?? "");

  function handleCreateImpediment() {
    if (!blockers.trim()) {
      return;
    }
    startImpedimentTransition(async () => {
      try {
        await createImpediment({
          teamId,
          title: blockers.trim(),
          status: "OPEN",
        });
        setImpedimentCreated(true);
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "Erro ao criar impedimento."
        );
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      try {
        await upsertStandupEntry({
          teamId,
          date: new Date(todayIso),
          yesterday,
          today,
          blockers,
        });
        setSubmitted(true);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao salvar standup.");
      }
    });
  }

  return (
    <Card className="overflow-hidden">
      <CosmosHeader
        action={
          submitted ? (
            <span className="flex items-center gap-1 font-medium text-emerald-600 text-xs dark:text-emerald-400">
              <CheckIcon className="h-3.5 w-3.5" />
              Salvo
            </span>
          ) : undefined
        }
        icon={<MicIcon className="h-4 w-4" />}
        title="Meu Standup de Hoje"
        tone="accent"
      />
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm" htmlFor="yesterday">
              O que fiz ontem?
            </Label>
            <textarea
              className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="yesterday"
              maxLength={2000}
              onChange={(e) => setYesterday(e.target.value)}
              placeholder="Descreva o que você fez…"
              value={yesterday}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm" htmlFor="today">
              O que farei hoje?
            </Label>
            <textarea
              className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="today"
              maxLength={2000}
              onChange={(e) => setToday(e.target.value)}
              placeholder="Descreva o que você planeja fazer…"
              value={today}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm" htmlFor="blockers">
              Há bloqueios?
            </Label>
            <textarea
              className="min-h-[60px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="blockers"
              maxLength={2000}
              onChange={(e) => {
                setBlockers(e.target.value);
                setImpedimentCreated(false);
              }}
              placeholder="Nenhum / Descreva os bloqueios…"
              value={blockers}
            />
            {blockers.trim() && (
              <button
                className="flex items-center gap-1 self-start font-medium text-[#5e6ad2] text-xs transition-colors hover:underline disabled:opacity-50"
                disabled={isCreatingImpediment || impedimentCreated}
                onClick={handleCreateImpediment}
                type="button"
              >
                <AlertTriangleIcon className="h-3 w-3" />
                {impedimentCreated
                  ? "Impedimento criado ✓"
                  : isCreatingImpediment
                    ? "Criando…"
                    : "+ Registrar como impedimento rastreável"}
              </button>
            )}
          </div>
          <div className="flex justify-end">
            <Button disabled={isPending} size="sm" type="submit">
              <SendIcon className="mr-2 h-4 w-4" />
              {isPending ? "Salvando…" : existing ? "Atualizar" : "Enviar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
