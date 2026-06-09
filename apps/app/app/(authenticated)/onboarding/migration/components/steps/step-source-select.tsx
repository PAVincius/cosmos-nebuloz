"use client";

import { cn } from "@repo/design-system/lib/utils";
import { DatabaseIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { WizardStepHeader } from "../../../../components/wizard-ui";

export type MigrationSource = "csv" | "jira" | "azure" | "trello";

const SOURCES: { id: MigrationSource; label: string; description: string }[] = [
  {
    id: "csv",
    label: "CSV genérico",
    description: "Arquivo CSV de qualquer ferramenta",
  },
  {
    id: "jira",
    label: "Jira Cloud",
    description: "Projetos, épicos, stories, sprints",
  },
  {
    id: "azure",
    label: "Azure DevOps",
    description: "Work items, iterations, teams",
  },
  { id: "trello", label: "Trello", description: "Boards, lists, cards" },
];

export type SourceSelectFormData = {
  source: MigrationSource;
};

type Props = {
  defaultValues?: Partial<SourceSelectFormData>;
  onChange: (data: SourceSelectFormData) => void;
};

export function StepSourceSelect({ defaultValues, onChange }: Props) {
  const [selected, setSelected] = useState<MigrationSource>(
    defaultValues?.source ?? "csv"
  );

  useEffect(() => {
    onChange({ source: selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, selected]);

  function select(src: MigrationSource) {
    setSelected(src);
    onChange({ source: src });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="De onde você quer migrar seus dados?"
        icon={<DatabaseIcon className="h-5 w-5" />}
        title="Selecione a origem"
      />
      <div className="grid grid-cols-2 gap-3">
        {SOURCES.map((src) => (
          <button
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
              selected === src.id
                ? "border-primary bg-primary/5"
                : "hover:border-muted-foreground/50"
            )}
            key={src.id}
            onClick={() => select(src.id)}
            type="button"
          >
            <span className="font-medium text-sm">{src.label}</span>
            <span className="text-muted-foreground text-xs">
              {src.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
