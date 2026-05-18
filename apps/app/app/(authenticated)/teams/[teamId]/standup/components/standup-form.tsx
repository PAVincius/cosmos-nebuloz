"use client";

import { useTransition, useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { CheckIcon, SendIcon } from "lucide-react";
import { upsertStandupEntry } from "@/app/actions/standup";

interface StandupFormProps {
  teamId: string;
  todayIso: string; // "YYYY-MM-DD"
  existing?: {
    yesterday?: string | null;
    today?: string | null;
    blockers?: string | null;
  };
}

export function StandupForm({ teamId, todayIso, existing }: StandupFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const [yesterday, setYesterday] = useState(existing?.yesterday ?? "");
  const [today, setToday] = useState(existing?.today ?? "");
  const [blockers, setBlockers] = useState(existing?.blockers ?? "");

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Meu Standup de Hoje
          {submitted && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-normal">
              <CheckIcon className="h-3.5 w-3.5" />
              Salvo
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="yesterday" className="text-sm">
              O que fiz ontem?
            </Label>
            <textarea
              id="yesterday"
              value={yesterday}
              onChange={(e) => setYesterday(e.target.value)}
              placeholder="Descreva o que você fez…"
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              maxLength={2000}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="today" className="text-sm">
              O que farei hoje?
            </Label>
            <textarea
              id="today"
              value={today}
              onChange={(e) => setToday(e.target.value)}
              placeholder="Descreva o que você planeja fazer…"
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              maxLength={2000}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="blockers" className="text-sm">
              Há bloqueios?
            </Label>
            <textarea
              id="blockers"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Nenhum / Descreva os bloqueios…"
              className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} size="sm">
              <SendIcon className="mr-2 h-4 w-4" />
              {isPending ? "Salvando…" : existing ? "Atualizar" : "Enviar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
