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
type ParentItem = { id: string; title: string };
type EpicType = "EPIC" | "FEATURE" | "STORY";

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
  allowedTypes?: EpicType[];
  epics?: ParentItem[];
  features?: ParentItem[];
};

const TYPE_META: Record<
  EpicType,
  {
    label: string;
    createLabel: string;
    parentLabel: string;
    parentPlaceholder: string;
  }
> = {
  EPIC: {
    label: "Epic",
    createLabel: "Épico",
    parentLabel: "Tema Estratégico",
    parentPlaceholder: "Nenhum",
  },
  FEATURE: {
    label: "Feature",
    createLabel: "Feature",
    parentLabel: "Épico Pai",
    parentPlaceholder: "Selecionar épico…",
  },
  STORY: {
    label: "Story",
    createLabel: "Story",
    parentLabel: "Feature Pai",
    parentPlaceholder: "Selecionar feature…",
  },
};

type TemplateItem = { id: string; label: string };

const TEMPLATES: Record<EpicType, TemplateItem[]> = {
  EPIC: [
    { id: "safe-epic", label: "SAFe Epic" },
    { id: "techdebt", label: "Tech Debt" },
    { id: "compliance", label: "Compliance" },
    { id: "innovation", label: "Innovation" },
  ],
  FEATURE: [
    { id: "safe-feature", label: "SAFe Feature" },
    { id: "enabler", label: "Technical Enabler" },
    { id: "mvp", label: "MVP" },
    { id: "bugfix", label: "Bug Fix" },
  ],
  STORY: [
    { id: "safe-story", label: "SAFe Story" },
    { id: "spike", label: "Spike" },
    { id: "bugfix-story", label: "Bug Fix" },
    { id: "refactor", label: "Refactor" },
  ],
};

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  "safe-epic":
    "## Hipótese de Negócio\n\n## Resultados Esperados\n\n## MVPs\n\n## Métricas de Sucesso\n\n## Riscos\n",
  techdebt:
    "## Problema Atual\n\n## Solução Proposta\n\n## Impacto Técnico\n\n## Critérios de Conclusão\n",
  compliance:
    "## Requisito Regulatório\n\n## Escopo\n\n## Evidências de Conformidade\n\n## Prazo\n",
  innovation:
    "## Oportunidade\n\n## Hipótese\n\n## Experimento MVP\n\n## Métricas de Validação\n",
  "safe-feature":
    "## Benefício\n\n## Critérios de Aceitação\n\n## Dependências\n\n## Definition of Done\n",
  enabler:
    "## Objetivo Técnico\n\n## Solução\n\n## Impacto Arquitetural\n\n## Critérios de Conclusão\n",
  mvp: "## Problema\n\n## Solução Mínima\n\n## Hipótese de Validação\n\n## Métricas\n",
  bugfix:
    "## Descrição do Bug\n\n## Passos para Reproduzir\n\n## Correção Proposta\n\n## Testes\n",
  "safe-story":
    "## Como [persona], quero [ação] para [benefício]\n\n## Critérios de Aceitação\n\n## Notas Técnicas\n",
  spike:
    "## Pergunta a Responder\n\n## Abordagem de Investigação\n\n## Timebox\n\n## Output Esperado\n",
  "bugfix-story":
    "## Comportamento Atual\n\n## Comportamento Esperado\n\n## Passos para Reproduzir\n\n## Critérios de Conclusão\n",
  refactor:
    "## Problema Atual\n\n## Refatoração Proposta\n\n## Impacto e Riscos\n\n## Definition of Done\n",
};

const ALL_TYPES: EpicType[] = ["EPIC", "FEATURE", "STORY"];

function ParentSelectItems({
  epicType,
  themes,
  epics,
  features,
}: {
  epicType: EpicType;
  themes: Theme[];
  epics: ParentItem[];
  features: ParentItem[];
}) {
  if (epicType === "EPIC") {
    return themes.map((t) => (
      <SelectItem key={t.id} value={t.id}>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: t.color }}
          />
          {t.title}
        </span>
      </SelectItem>
    ));
  }
  const items = epicType === "FEATURE" ? epics : features;
  return items.map((item) => (
    <SelectItem key={item.id} value={item.id}>
      {item.title}
    </SelectItem>
  ));
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multi-type creation form with branchy per-type logic
export function EpicCreateModal({
  statusId,
  onClose,
  onCreated,
  themes,
  allowedTypes = ALL_TYPES,
  epics = [],
  features = [],
}: Props) {
  const [epicType, setEpicType] = useState<EpicType>(allowedTypes[0] ?? "EPIC");
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [transcription, setTranscription] = useState("");
  const [showTranscription, setShowTranscription] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const meta = TYPE_META[epicType];
  const showTypeSelector = allowedTypes.length > 1;

  const hasParentItems =
    (epicType === "EPIC" && themes.length > 0) ||
    (epicType === "FEATURE" && epics.length > 0) ||
    (epicType === "STORY" && features.length > 0);

  const handleTypeChange = (type: EpicType) => {
    setEpicType(type);
    setSelectedTemplate(null);
    setDescriptionMd("");
    setParentId("");
  };

  const handleTemplateChip = (chipId: string) => {
    setSelectedTemplate(chipId);
    setDescriptionMd(TEMPLATE_DESCRIPTIONS[chipId] ?? "");
  };

  const handleParentChange = (v: string) => {
    setParentId(v === "none" ? "" : v);
  };

  // AI suggest requires template selected + title filled
  const canSuggestTitle = !!selectedTemplate && !!title.trim();

  const handleSuggestTitle = () => {
    if (!canSuggestTitle) {
      return;
    }
    setIsSuggesting(true);
    suggestTitle({ partial: title })
      .then((result) => {
        if (result.ok && result.data) {
          setTitle(result.data);
        }
      })
      .catch(() => toast.error("Erro ao sugerir título"))
      .finally(() => setIsSuggesting(false));
  };

  const handleExtractTranscription = () => {
    if (!transcription.trim()) {
      return;
    }
    setIsExtracting(true);
    extractTranscription({ transcription })
      .then((result) => {
        if (result.ok && result.data) {
          setDescriptionMd(result.data);
          toast.success("Estrutura extraída com sucesso");
        } else {
          toast.error("Erro ao extrair estrutura");
        }
      })
      .catch(() => toast.error("Erro ao extrair estrutura"))
      .finally(() => setIsExtracting(false));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }
    startTransition(async () => {
      // parentId maps to strategicThemeId for all types until backend adds
      // parentEpicId / parentFeatureId fields to the schema.
      const result = await createEpic({
        title: title.trim(),
        statusId,
        strategicThemeId: parentId || null,
        descriptionMd: descriptionMd || null,
        epicType,
        dueDate: null,
        transcription: transcription || null,
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        onClose();
      } else {
        toast.error("Erro ao criar item");
      }
    });
  };

  const epicContext = `Tipo: ${epicType}\nTítulo: "${title}"\nDescrição: ${descriptionMd}`;

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
            Novo {meta.createLabel.toLowerCase()}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Type selector — hidden when only one type is allowed */}
          {showTypeSelector ? (
            <div className="flex gap-2">
              {allowedTypes.map((t) => (
                <button
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    epicType === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  type="button"
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Title + AI suggest */}
          <div className="space-y-1">
            <Input
              className="font-semibold text-base"
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Título do ${meta.createLabel.toLowerCase()}…`}
              required
              value={title}
            />
            <div className="flex gap-1.5 pt-1">
              <button
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-indigo-500 transition-colors hover:bg-muted disabled:opacity-50"
                disabled={!canSuggestTitle || isSuggesting}
                onClick={handleSuggestTitle}
                title={
                  canSuggestTitle
                    ? null
                    : "Selecione um template e preencha o título primeiro"
                }
                type="button"
              >
                <span>✦</span>
                {isSuggesting ? "Sugerindo…" : "Sugerir título"}
              </button>
            </div>
          </div>

          {/* Templates — type-specific chips */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Template</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES[epicType].map((chip) => (
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

          {/* Parent selector — label and items adapt per type */}
          {hasParentItems ? (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {meta.parentLabel}
              </Label>
              <Select
                onValueChange={handleParentChange}
                value={parentId || "none"}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={meta.parentPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <ParentSelectItems
                    epics={epics}
                    epicType={epicType}
                    features={features}
                    themes={themes}
                  />
                </SelectContent>
              </Select>
            </div>
          ) : null}

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
            {showTranscription ? (
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
            ) : null}
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
            <Button
              disabled={isPending || !title.trim()}
              type="submit"
              variant="glow"
            >
              {isPending ? "Criando…" : `Criar ${meta.createLabel}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
