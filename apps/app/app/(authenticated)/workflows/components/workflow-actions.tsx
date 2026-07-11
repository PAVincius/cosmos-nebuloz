"use client";

import { CosmosButton } from "@repo/design-system/components/cosmos/cosmos-button";
import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { BookOpen, Plus, Workflow as WorkflowIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ModalShell } from "../../components/modal-shell";
import { saveBpmnDefinition } from "../actions";
import { BPMN_TEMPLATES, type BpmnTemplate } from "../lib/bpmn-templates";

type TeamOption = { id: string; name: string };

type View = "gallery" | "create";

const CATEGORY_LABEL: Record<BpmnTemplate["category"], string> = {
  safe: "SAFe",
  scrum: "Scrum",
  blank: "Vazio",
};

// BpmnDefinition.entityType is STORY|FEATURE|EPIC|CUSTOM — templates use a
// simpler safe|scrum|blank taxonomy, so map onto the closest entity type.
const CATEGORY_ENTITY_TYPE: Record<BpmnTemplate["category"], string> = {
  safe: "FEATURE",
  scrum: "STORY",
  blank: "CUSTOM",
};

/**
 * "Templates" + "Criar workflow" header CTAs. Both open the same modal:
 * Templates opens on the template gallery; Criar workflow opens straight to
 * the team/template picker. Submitting calls the real `saveBpmnDefinition`
 * action (new inactive draft version) and hands off to the BPMN editor.
 */
export function WorkflowActions({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("gallery");
  const [templateId, setTemplateId] = useState(BPMN_TEMPLATES[0].id);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const template =
    BPMN_TEMPLATES.find((t) => t.id === templateId) ?? BPMN_TEMPLATES[0];

  const openGallery = () => {
    setView("gallery");
    setOpen(true);
  };

  const openCreate = () => {
    setView("create");
    setOpen(true);
  };

  const useTemplate = (id: string) => {
    setTemplateId(id);
    setView("create");
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    setOpen(false);
    setView("gallery");
  };

  const handleSubmit = async () => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      toast.error("Selecione uma equipe.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await saveBpmnDefinition({
        name: `${team.name} · ${template.label}`,
        xml: template.xml,
        entityType: CATEGORY_ENTITY_TYPE[template.category],
        ownerType: "TEAM",
        ownerId: team.id,
      });
      if (!result.ok) {
        toast.error(
          result.error.elements[0]?.error ??
            "Não foi possível criar o workflow."
        );
        return;
      }
      toast.success(`Workflow criado para ${team.name}.`);
      setOpen(false);
      router.push(`/workflows/${team.id}/bpmn`);
      router.refresh();
    } catch {
      toast.error("Não foi possível criar o workflow.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <CosmosButton onClick={openGallery} size="md" variant="secondary">
        <BookOpen size={14} /> Templates
      </CosmosButton>
      <CosmosButton onClick={openCreate} size="md" variant="primary">
        <Plus size={14} /> Criar workflow
      </CosmosButton>

      <ModalShell
        eyebrow={view === "gallery" ? "Biblioteca BPMN" : "Nova automação"}
        footer={
          view === "create" ? (
            <>
              <Button
                disabled={submitting}
                onClick={() => setView("gallery")}
                type="button"
                variant="ghost"
              >
                Voltar
              </Button>
              <Button
                disabled={submitting || teams.length === 0}
                onClick={handleSubmit}
                type="button"
              >
                <WorkflowIcon aria-hidden className="mr-1 h-4 w-4" />
                {submitting ? "Criando…" : "Criar workflow"}
              </Button>
            </>
          ) : undefined
        }
        loading={submitting}
        onClose={handleClose}
        open={open}
        size={view === "gallery" ? "lg" : "md"}
        title={view === "gallery" ? "Templates de workflow" : "Criar workflow"}
      >
        {view === "gallery" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BPMN_TEMPLATES.map((tpl) => (
              <div
                className="flex flex-col gap-2 rounded-cosmos-md border border-hairline bg-surface-2 p-3.5"
                key={tpl.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[13.5px] text-ink">
                    {tpl.label}
                  </span>
                  <span
                    className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10px] text-ink-muted uppercase"
                    style={{ background: "var(--chip-bg)" }}
                  >
                    {CATEGORY_LABEL[tpl.category]}
                  </span>
                </div>
                <p className="text-[12px] text-ink-muted leading-relaxed">
                  {tpl.description}
                </p>
                <Button
                  className="mt-1 self-start"
                  onClick={() => useTemplate(tpl.id)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Usar este template
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label>Equipe</Label>
              {teams.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">
                  Nenhuma equipe disponível. Crie uma equipe em ARTs primeiro.
                </p>
              ) : (
                <Select onValueChange={setTeamId} value={teamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Template</Label>
              <Select onValueChange={setTemplateId} value={templateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BPMN_TEMPLATES.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11.5px] text-ink-muted">
                {template.description}
              </p>
            </div>
          </div>
        )}
      </ModalShell>
    </>
  );
}
