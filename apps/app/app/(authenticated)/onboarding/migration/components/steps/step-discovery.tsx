"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { SearchIcon } from "lucide-react";
import { WizardStepHeader } from "../../../../components/wizard-ui";
import type { MappingRule } from "@/lib/migration/types";

interface DiscoveryProject {
  id?: string;
  key?: string;
  name: string;
}

export interface DiscoveryFormData {
  connectionId: string;
  mappingData: MappingRule[];
  itemCount: number;
}

interface Props {
  connectionId: string;
  source: string;
  artNames: string[];
  defaultValues?: Partial<DiscoveryFormData>;
  onChange: (data: DiscoveryFormData) => void;
}

export function StepDiscovery({
  connectionId,
  source,
  artNames,
  onChange,
}: Props) {
  const [projects, setProjects] = useState<DiscoveryProject[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!connectionId) return;
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
        onChange({ connectionId, mappingData: rules, itemCount: data.itemCount });
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, source]);

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
        icon={<SearchIcon className="h-5 w-5" />}
        title="Mapeamento de projetos"
        description="Mapeie cada projeto para o ART correspondente."
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Descobrindo projetos...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {projects.length} projeto(s) · {itemCount} itens encontrados
          </p>
          {projects.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.key && (
                  <p className="text-xs text-muted-foreground">{p.key}</p>
                )}
              </div>
              <span className="text-muted-foreground text-xs">→</span>
              <Select
                value={mapping[p.name] ?? ""}
                onValueChange={(v) => updateMapping(p.name, v)}
              >
                <SelectTrigger className="w-44 text-xs">
                  <SelectValue placeholder="Selecionar ART" />
                </SelectTrigger>
                <SelectContent>
                  {artNames.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">
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
