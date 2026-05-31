"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createEpic } from "@/app/actions/epics/create-epic";
import { extractTranscription } from "@/app/actions/epics/extract-transcription";
import { suggestTitle } from "@/app/actions/epics/suggest-title";
import { AIActionButtons } from "./ai-action-buttons";

type Theme = { id: string; title: string; color: string };

type Props = {
  statusId: string;
  onClose: () => void;
  onCreated: (epic: {
    id: string;
    title: string;
    statusId: string;
    order: number;
  }) => void;
  themes: Theme[];
};

type EpicType = "EPIC" | "FEATURE" | "STORY";

const EPIC_TYPES: { value: EpicType; label: string }[] = [
  { value: "EPIC", label: "Epic" },
  { value: "FEATURE", label: "Feature" },
  { value: "STORY", label: "Story" },
];

const TEMPLATE_CHIPS = [
  { id: "safe", label: "SAFe Epic" },
  { id: "techdebt", label: "Tech Debt" },
  { id: "compliance", label: "Compliance" },
  { id: "innovation", label: "Innovation" },
];

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  safe: "## Hipótese de Negócio\n\n## Resultados Esperados\n\n## MVPs\n\n## Métricas de Sucesso\n\n## Riscos\n",
  techdebt:
    "## Problema Atual\n\n## Solução Proposta\n\n## Impacto Técnico\n\n## Critérios de Conclusão\n",
  compliance:
    "## Requisito Regulatório\n\n## Escopo\n\n## Evidências de Conformidade\n\n## Prazo\n",
  innovation:
    "## Oportunidade\n\n## Hipótese\n\n## Experimento MVP\n\n## Métricas de Validação\n",
};

export function EpicCreateModal({
  statusId,
  onClose,
  onCreated,
  themes,
}: Props) {
  const [title, setTitle] = useState("");
  const [epicType, setEpicType] = useState<EpicType>("EPIC");
  const [themeId, setThemeId] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [transcription, setTranscription] = useState("");
  const [showTranscription, setShowTranscription] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleTemplateChip = (chipId: string) => {
    setSelectedTemplate(chipId);
    setDescriptionMd(TEMPLATE_DESCRIPTIONS[chipId] ?? "");
  };

  const handleSuggestTitle = () => {
    if (!title.trim()) {
      return;
    }
    setIsSuggesting(true);
    suggestTitle({ partial: title }).then((result) => {
      setIsSuggesting(false);
      if (result.ok && result.data) {
        setTitle(result.data);
      }
    });
  };

  const handleExtractTranscription = () => {
    if (!transcription.trim()) {
      return;
    }
    setIsExtracting(true);
    extractTranscription({ transcription }).then((result) => {
      setIsExtracting(false);
      if (result.ok && result.data) {
        setDescriptionMd(result.data);
        toast.success("Estrutura extraída com sucesso");
      } else {
        toast.error("Erro ao extrair estrutura");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }
    startTransition(async () => {
      const result = await createEpic({
        title: title.trim(),
        statusId,
        strategicThemeId: themeId || null,
        descriptionMd: descriptionMd || null,
        epicType,
        dueDate: null,
        transcription: transcription || null,
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        onClose();
      } else {
        toast.error("Erro ao criar épico");
      }
    });
  };

  const epicContext = `Épico: "${title}"\nTipo: ${epicType}\nDescrição: ${descriptionMd}`;
  let createLabel: string;
  if (epicType === "EPIC") {
    createLabel = "Épico";
  } else if (epicType === "FEATURE") {
    createLabel = "Feature";
  } else {
    createLabel = "Story";
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold text-base">
            Novo item
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Type selector */}
          <div className="flex gap-2">
            {EPIC_TYPES.map((t) => (
              <button
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  epicType === t.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                )}
                key={t.value}
                onClick={() => setEpicType(t.value)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Title + AI chip */}
          <div className="space-y-1">
            <Input
              className="font-semibold text-base"
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Título do ${createLabel.toLowerCase()}…`}
              required
              value={title}
            />
            <div className="flex gap-1.5 pt-1">
              <button
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-indigo-500 transition-colors hover:bg-muted disabled:opacity-50"
                disabled={!title.trim() || isSuggesting}
                onClick={handleSuggestTitle}
                type="button"
              >
                <span>✦</span>
                {isSuggesting ? "Sugerindo…" : "Sugerir título"}
              </button>
            </div>
          </div>

          {/* Template chips */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Template</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_CHIPS.map((chip) => (
                <button
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    selectedTemplate === chip.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  )}
                  key={chip.id}
                  onClick={() => handleTemplateChip(chip.id)}
                  type="button"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* MetaGrid - Theme */}
          {themes.length > 0 && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                Tema Estratégico
              </Label>
              <Select onValueChange={setThemeId} value={themeId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {themes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Transcription collapsible */}
          <div className="space-y-2">
            <button
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowTranscription(!showTranscription)}
              type="button"
            >
              <span
                className={cn(
                  "transition-transform duration-200",
                  showTranscription ? "rotate-90" : ""
                )}
              >
                ▶
              </span>
              Transcrição de reunião
            </button>
            {!!showTranscription && (
              <div className="space-y-2">
                <Textarea
                  className="min-h-[80px] text-xs"
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="Cole as notas da reunião aqui…"
                  value={transcription}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {transcription.length} caracteres
                  </span>
                  <button
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] text-indigo-500 transition-colors hover:bg-muted disabled:opacity-50"
                    disabled={!transcription.trim() || isExtracting}
                    onClick={handleExtractTranscription}
                    type="button"
                  >
                    <span>✦</span>
                    {isExtracting ? "Extraindo…" : "Extrair estrutura"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Action Buttons */}
          {!!title.trim() && <AIActionButtons epicContext={epicContext} />}

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              disabled={isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={isPending || !title.trim()} type="submit">
              {isPending ? "Criando…" : `Criar ${createLabel}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
