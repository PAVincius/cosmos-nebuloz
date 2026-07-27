"use client";

import { CosmosButton } from "@repo/design-system/components/cosmos/cosmos-button";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import { createStrategicTheme } from "@/app/actions/strategic-themes";
import {
  INITIAL_NEW_THEME_FORM,
  NewThemeForm,
  type NewThemeFormState,
} from "./new-theme-form";

type NewThemeButtonProps = {
  nextOrder: number;
};

export function NewThemeButton({ nextOrder }: NewThemeButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewThemeFormState>(INITIAL_NEW_THEME_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setField<K extends keyof NewThemeFormState>(
    key: K,
    value: NewThemeFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit() {
    const trimmed = form.title.trim();
    if (!trimmed) {
      setError("Nome do tema é obrigatório.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createStrategicTheme({
        title: trimmed,
        description: form.description.trim() || undefined,
        code: form.code.trim() || undefined,
        color: form.color,
        order: nextOrder,
        horizon: form.horizon.trim() || undefined,
        themeType: form.themeType || undefined,
        budgetTotal: form.budgetTotal
          ? Number.parseFloat(form.budgetTotal)
          : undefined,
        targetAllocationPct: form.targetAllocationPct
          ? Number.parseFloat(form.targetAllocationPct)
          : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success("Tema criado", { description: trimmed });
      setOpen(false);
      setForm(INITIAL_NEW_THEME_FORM);
      router.refresh();
    });
  }

  return (
    <>
      <CosmosButton
        onClick={() => setOpen(true)}
        size="md"
        type="button"
        variant="primary"
      >
        <PlusIcon size={16} strokeWidth={2.4} />
        Novo tema
      </CosmosButton>

      <ModalShell
        eyebrow="Portfolio · Temas Estratégicos"
        footer={
          <>
            <CosmosButton
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </CosmosButton>
            <CosmosButton
              disabled={isPending}
              onClick={handleSubmit}
              type="button"
              variant="primary"
            >
              {isPending ? "Criando…" : "Criar tema"}
            </CosmosButton>
          </>
        }
        onClose={() => {
          if (isPending) {
            return;
          }
          setOpen(false);
        }}
        open={open}
        title="Novo tema estratégico"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error ? (
            <div
              role="alert"
              style={{
                borderRadius: "var(--cosmos-r-md)",
                border: "1px solid rgba(var(--red-rgb),.3)",
                background: "var(--red-soft)",
                color: "var(--red-text)",
                fontSize: 12.5,
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          ) : null}
          <NewThemeForm form={form} setField={setField} />
        </div>
      </ModalShell>
    </>
  );
}
