"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import {
  createTagRule,
  type TagRuleCondition,
} from "@/app/actions/billing/tag-rules";

// Same 6 tones as strategy-map's new-theme-modal `TONE_OPTIONS`, reused here
// for the output tag color picker.
const TONE_OPTIONS = [
  { name: "accent", hex: "var(--accent-c)" },
  { name: "blue", hex: "#2563eb" },
  { name: "purple", hex: "#7c3aed" },
  { name: "green", hex: "#16a34a" },
  { name: "amber", hex: "#d97706" },
  { name: "red", hex: "#e11d48" },
] as const;

const OPERATOR_OPTIONS: {
  value: TagRuleCondition["operator"];
  label: string;
}[] = [
  { value: "eq", label: "é igual a" },
  { value: "contains", label: "contém" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
];

type ConditionDraft = {
  field: string;
  operator: TagRuleCondition["operator"];
  value: string;
};

function emptyCondition(): ConditionDraft {
  return { field: "", operator: "eq", value: "" };
}

type NewTagRuleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewTagRuleModal({ open, onOpenChange }: NewTagRuleModalProps) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [conditions, setConditions] = useState<ConditionDraft[]>([
    emptyCondition(),
  ]);
  const [outputTag, setOutputTag] = useState("");
  const [outputTagTone, setOutputTagTone] =
    useState<(typeof TONE_OPTIONS)[number]["name"]>("accent");
  const [priority, setPriority] = useState("0");
  const [enabled, setEnabled] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setName("");
    setScope("");
    setConditions([emptyCondition()]);
    setOutputTag("");
    setOutputTagTone("accent");
    setPriority("0");
    setEnabled(true);
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  function updateCondition(index: number, patch: Partial<ConditionDraft>) {
    setConditions((prev) =>
      prev.map((condition, i) =>
        i === index ? { ...condition, ...patch } : condition
      )
    );
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Nome obrigatório");
      return;
    }
    const validConditions = conditions
      .filter((condition) => condition.field.trim() && condition.value.trim())
      .map((condition) => ({
        field: condition.field.trim(),
        operator: condition.operator,
        value: condition.value.trim(),
      }));

    startTransition(async () => {
      const result = await createTagRule({
        name: trimmedName,
        scope: scope.trim() || undefined,
        conditions: validConditions.length > 0 ? validConditions : undefined,
        outputTag: outputTag.trim() || undefined,
        outputTagTone,
        priority: Number.parseInt(priority, 10) || 0,
        enabled,
        matchType: "EXACT",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Regra criada", { description: trimmedName });
      close();
      router.refresh();
    });
  }

  return (
    <ModalShell
      eyebrow="Aplica tags automaticamente a épicos, features e value streams quando a condição é satisfeita"
      footer={
        <>
          <Button onClick={close} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={handleSubmit} type="button">
            <CheckIcon className="h-3.5 w-3.5" />
            Criar regra
          </Button>
        </>
      }
      onClose={close}
      open={open}
      title="Nova regra de automação"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tr-name">
            Nome da regra <span className="text-rose-500">*</span>
          </Label>
          <Input
            autoFocus
            id="tr-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="ex: Débito técnico crítico"
            value={name}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tr-scope">Escopo</Label>
          <Input
            id="tr-scope"
            onChange={(event) => setScope(event.target.value)}
            placeholder="ex: Épicos e Features"
            value={scope}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Condições (SE)</Label>
          <div className="flex flex-col gap-2">
            {conditions.map((condition, index) => (
              <div
                className="flex items-center gap-2"
                key={`condition-${index}`}
              >
                <Input
                  className="flex-1"
                  onChange={(event) =>
                    updateCondition(index, { field: event.target.value })
                  }
                  placeholder="campo (ex: prioridade)"
                  value={condition.field}
                />
                <Select
                  onValueChange={(value) =>
                    updateCondition(index, {
                      operator: value as ConditionDraft["operator"],
                    })
                  }
                  value={condition.operator}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  onChange={(event) =>
                    updateCondition(index, { value: event.target.value })
                  }
                  placeholder="valor (ex: P0)"
                  value={condition.value}
                />
                <Button
                  disabled={conditions.length === 1}
                  onClick={() =>
                    setConditions((prev) => prev.filter((_, i) => i !== index))
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="w-fit gap-1.5"
            onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
            size="sm"
            type="button"
            variant="ghost"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar condição
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tr-tag">Tag de saída</Label>
            <Input
              id="tr-tag"
              onChange={(event) => setOutputTag(event.target.value)}
              placeholder="ex: compliance"
              value={outputTag}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tr-priority">Prioridade</Label>
            <Input
              id="tr-priority"
              min="0"
              onChange={(event) => setPriority(event.target.value)}
              type="number"
              value={priority}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Cor da tag</Label>
          <div className="flex flex-wrap gap-3.5">
            {TONE_OPTIONS.map((tone) => (
              <label
                className="flex cursor-pointer items-center gap-1.5 text-xs capitalize"
                key={tone.name}
              >
                <input
                  checked={outputTagTone === tone.name}
                  className="sr-only"
                  name="tr-tone"
                  onChange={() => setOutputTagTone(tone.name)}
                  type="radio"
                  value={tone.name}
                />
                <span
                  className="h-4 w-4 rounded-[6px] border-2 transition-transform hover:scale-110"
                  style={{
                    background: tone.hex,
                    borderColor:
                      outputTagTone === tone.name
                        ? "var(--foreground)"
                        : "transparent",
                  }}
                />
                {tone.name}
              </label>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(value) => setEnabled(value === true)}
          />
          Ativar regra imediatamente
        </label>
      </div>
    </ModalShell>
  );
}
