"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";

export interface OrgChartFormData {
  nodes: { name: string; role: string; parentName: string }[];
}

interface Props {
  defaultValues?: Partial<OrgChartFormData>;
  onChange: (data: OrgChartFormData) => void;
}

export function StepOrgChart({ defaultValues, onChange }: Props) {
  const [data, setData] = useState<OrgChartFormData>({
    nodes: defaultValues?.nodes ?? [{ name: "", role: "", parentName: "" }],
  });

  function update(nodes: OrgChartFormData["nodes"]) {
    const next = { nodes };
    setData(next);
    onChange(next);
  }

  function updateNode(
    i: number,
    patch: Partial<OrgChartFormData["nodes"][0]>
  ) {
    update(data.nodes.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <UsersIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Organograma mínimo</h2>
          <p className="text-sm text-muted-foreground">
            Opcional. Lideranças e hierarquia básica. Pode ser expandido depois.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-medium px-1">
          <span>Nome</span>
          <span>Cargo</span>
          <span>Manager (nome)</span>
        </div>
        {data.nodes.map((node, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <Input
              value={node.name}
              onChange={(e) => updateNode(i, { name: e.target.value })}
              placeholder="Nome"
            />
            <Input
              value={node.role}
              onChange={(e) => updateNode(i, { role: e.target.value })}
              placeholder="ex: CTO"
            />
            <div className="flex gap-1">
              <Input
                value={node.parentName}
                onChange={(e) =>
                  updateNode(i, { parentName: e.target.value })
                }
                placeholder="Nome do manager"
              />
              {data.nodes.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update(data.nodes.filter((_, j) => j !== i))
                  }
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() =>
            update([
              ...data.nodes,
              { name: "", role: "", parentName: "" },
            ])
          }
        >
          <PlusIcon className="mr-1 h-3.5 w-3.5" /> Pessoa
        </Button>
      </div>
    </div>
  );
}
