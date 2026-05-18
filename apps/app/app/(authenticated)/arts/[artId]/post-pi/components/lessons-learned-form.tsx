"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Label } from "@repo/design-system/components/ui/label";
import { saveSessionNotes } from "../actions";

interface LessonsLearnedFormProps {
  piSessionId: string | null;
  piPlanId: string;
  artId: string;
  initialNotes: string;
}

export function LessonsLearnedForm({
  piSessionId,
  piPlanId,
  artId,
  initialNotes,
}: LessonsLearnedFormProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveSessionNotes({ piSessionId, piPlanId, artId, notes });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lessons">Lições Aprendidas</Label>
        <Textarea
          id="lessons"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          placeholder="Registre o que funcionou bem, o que pode melhorar e ações para o próximo PI…"
          rows={6}
          className="resize-none"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Salvo com sucesso!</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar Lições"}
        </Button>
      </div>
    </form>
  );
}
