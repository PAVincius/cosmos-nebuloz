"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { SearchIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { MappingRule } from "@/lib/migration/types";
import { WizardStepHeader } from "../../../../components/wizard-ui";

type DiscoveryProject = {
  id?: string;
  key?: string;
  name: string;
};

export type DiscoveryFormData = {
  connectionId: string;
  mappingData: MappingRule[];
  itemCount: number;
};

type Props = {
  connectionId: string;
  source: string;
  artNames: string[];
  defaultValues?: Partial<DiscoveryFormData>;
  onChange: (data: DiscoveryFormData) => void;
};

export function StepDiscovery({
  connectionId,
  source,
  artNames,
  defaultValues,
  onChange,
}: Props) {
  const [projects, setProjects] = useState<DiscoveryProject[]>([]);
  const initialMapping = defaultValues?.mappingData
    ? Object.fromEntries(
        defaultValues.mappingData.map((r) => [r.sourceKey, r.targetName])
      )
    : {};
  const [mapping, setMapping] =
    useState<Record<string, string>>(initialMapping);
  const [itemCount, setItemCount] = useState(defaultValues?.itemCount ?? 0);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!connectionId) {
      return;
    }
    startTransition(async () => {
      setLoading(true);
      const res = await fetch(`/api/migration/${source}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          projects: DiscoveryProject[];
          itemCount: number;
        };
        setProjects(data.projects);
        setItemCount(data.itemCount);
        const defaultMapping: Record<string, string> = {};
        for (const p of data.projects) {
          defaultMapping[p.name] = artNames[0] ?? "";
        }
        setMapping(defaultMapping);
        const rules = toRules(defaultMapping);
        onChange({
          connectionId,
          mappingData: rules,
          itemCount: data.itemCount,
        });
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, source, artNames[0], onChange, toRules]);

  function toRules(m: Record<string, string>): MappingRule[] {
    return Object.entries(m).map(([sourceKey, targetName]) => ({
      sourceKey,
      targetType: "art" as const,
      targetName,
    }));
  }

  function updateMapping(projectName: string, artName: string) {
    const next = { ...mapping, [projectName]: artName };
    setMapping(next);
    onChange({ connectionId, mappingData: toRules(next), itemCount });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Mapeie cada projeto para o ART correspondente."
        icon={<SearchIcon className="h-5 w-5" />}
        title="Mapeamento de projetos"
      />
      {loading ? (
        <p className="text-muted-foreground text-sm">Descobrindo projetos...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {projects.length} projeto(s) · {itemCount} itens encontrados
          </p>
          {projects.map((p) => (
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              key={p.name}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{p.name}</p>
                {p.key && (
                  <p className="text-muted-foreground text-xs">{p.key}</p>
                )}
              </div>
              <span className="text-muted-foreground text-xs">→</span>
              <Select
                onValueChange={(v) => updateMapping(p.name, v)}
                value={mapping[p.name] ?? ""}
              >
                <SelectTrigger className="w-44 text-xs">
                  <SelectValue placeholder="Selecionar ART" />
                </SelectTrigger>
                <SelectContent>
                  {artNames.map((a) => (
                    <SelectItem className="text-xs" key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
