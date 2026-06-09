"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState, useTransition } from "react";
import { saveSessionNotes } from "../actions";

type LessonsLearnedFormProps = {
  piSessionId: string | null;
  piPlanId: string;
  artId: string;
  initialNotes: string;
};

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
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lessons">Lições Aprendidas</Label>
        <Textarea
          className="resize-none"
          id="lessons"
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          placeholder="Registre o que funcionou bem, o que pode melhorar e ações para o próximo PI…"
          rows={6}
          value={notes}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">Salvo com sucesso!</p>}
      <div className="flex justify-end">
        <Button disabled={isPending} type="submit">
          {isPending ? "Salvando…" : "Salvar Lições"}
        </Button>
      </div>
    </form>
  );
}
