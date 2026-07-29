"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { FlagIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createEpic } from "@/app/actions/epics/create-epic";
import { ModalShell } from "../../components/modal-shell";
import type { KanbanThemeOption } from "./kanban-toolbar";

type EpicQuickAddModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  themes: KanbanThemeOption[];
  defaultStatusId: string;
};

const NO_THEME = "none";

/** M1 — modal "+ Épico" (modal.js:72, openEpicModal). Campos limitados ao que createEpic persiste. */
export function EpicQuickAddModal({
  open,
  onClose,
  onCreated,
  themes,
  defaultStatusId,
}: EpicQuickAddModalProps) {
  const [title, setTitle] = useState("");
  const [themeId, setThemeId] = useState(NO_THEME);
  const [hypothesis, setHypothesis] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setThemeId(NO_THEME);
    setHypothesis("");
    setDueDate("");
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (title.trim().length < 3) {
      toast.error("Título deve ter ao menos 3 caracteres.");
      return;
    }
    setSubmitting(true);
    const result = await createEpic({
      title: title.trim(),
      statusId: defaultStatusId,
      strategicThemeId: themeId === NO_THEME ? undefined : themeId,
      descriptionMd: hypothesis.trim() || undefined,
      epicType: "EPIC",
      dueDate: dueDate
        ? new Date(`${dueDate}T00:00:00Z`).toISOString()
        : undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(`Não foi possível criar o épico: ${result.error}`);
      return;
    }

    toast.success(`Épico "${result.data.title}" criado.`);
    reset();
    onCreated();
  };

  const selectedTheme = themes.find((t) => t.id === themeId);

  return (
    <ModalShell
      eyebrow="Novo Épico"
      footer={
        <>
          <Button
            disabled={submitting}
            onClick={handleClose}
            type="button"
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button disabled={submitting} onClick={handleSubmit} type="button">
            {submitting ? "Criando…" : "Criar Épico"}
          </Button>
        </>
      }
      loading={submitting}
      onClose={handleClose}
      open={open}
      size="md"
      title="Criar Épico"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,180px)_1fr]">
        <div className="rounded-cosmos-md border border-hairline-strong bg-surface p-3">
          <span className="mb-2 block text-[10px] text-ink-muted uppercase tracking-wide">
            Preview
          </span>
          <div className="rounded-cosmos-md border border-hairline bg-surface-2 p-3">
            <div className="mb-2 font-semibold text-[13px] text-ink leading-snug">
              {title.trim() || "Título do épico"}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-ink-muted">
              <span className="inline-flex items-center gap-1 rounded-cosmos-pill bg-surface-3 px-1.5 py-0.5">
                <FlagIcon aria-hidden size={9} />
                Épico
              </span>
              {selectedTheme && (
                <span
                  className="inline-flex items-center gap-1 rounded-cosmos-pill px-1.5 py-0.5"
                  style={{ background: `${selectedTheme.color}22` }}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: selectedTheme.color }}
                  />
                  {selectedTheme.title}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label
              className="mb-1 block text-[11px] text-ink-muted"
              htmlFor="epic-title"
            >
              Título*
            </label>
            <Input
              autoFocus
              id="epic-title"
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Checkout unificado multi-moeda"
              value={title}
            />
          </div>

          <div>
            <label
              className="mb-1 block text-[11px] text-ink-muted"
              htmlFor="epic-theme"
            >
              Tema estratégico
            </label>
            <Select onValueChange={setThemeId} value={themeId}>
              <SelectTrigger id="epic-theme">
                <SelectValue placeholder="Sem tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_THEME}>Sem tema</SelectItem>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              className="mb-1 block text-[11px] text-ink-muted"
              htmlFor="epic-hypothesis"
            >
              Hipótese
            </label>
            <Textarea
              id="epic-hypothesis"
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="Se fizermos X, esperamos Y, medido por Z…"
              rows={4}
              value={hypothesis}
            />
          </div>

          <div>
            <label
              className="mb-1 block text-[11px] text-ink-muted"
              htmlFor="epic-due-date"
            >
              Data alvo
            </label>
            <Input
              id="epic-due-date"
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              value={dueDate}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
