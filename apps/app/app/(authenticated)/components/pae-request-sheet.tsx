"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPAERequest } from "@/app/actions/pae/index";
import { PAE_DURATIONS, type PAEDuration } from "@/app/actions/pae/schema";
import type { EntityType, PolicyAction } from "@/app/actions/permissions";

type PAERequestSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  action: PolicyAction;
  targetEntityId?: string;
};

const DURATION_LABELS: Record<PAEDuration, string> = {
  "1h": "1h",
  "4h": "4h",
  "8h": "8h",
  "24h": "24h",
};

export function PAERequestSheet({
  open,
  onOpenChange,
  entityType,
  action,
  targetEntityId,
}: PAERequestSheetProps) {
  const [duration, setDuration] = useState<PAEDuration>("4h");
  const [justification, setJustification] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createPAERequest({
        entityType,
        action,
        duration,
        justification: justification.trim() || undefined,
        targetEntityId,
      });

      if (result.ok) {
        toast.success("Solicitação enviada. Aguarde aprovação.");
        onOpenChange(false);
        setJustification("");
        setDuration("4h");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-[400px] sm:w-[480px]" side="right">
        <SheetHeader>
          <SheetTitle>Solicitar Exceção de Acesso</SheetTitle>
          <SheetDescription>
            {action} · {entityType} · requer permissão superior
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Duração
            </p>
            <div className="flex gap-2">
              {PAE_DURATIONS.map((d) => (
                <button
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    duration === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                  }`}
                  key={d}
                  onClick={() => setDuration(d)}
                  type="button"
                >
                  {DURATION_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Justificativa{" "}
              <span className="text-muted-foreground/60 normal-case">
                (opcional)
              </span>
            </p>
            <Textarea
              maxLength={500}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Motivo da solicitação..."
              rows={3}
              value={justification}
            />
            <p className="mt-1 text-right text-muted-foreground text-xs">
              {justification.length}/500
            </p>
          </div>

          <Button
            className="w-full"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
