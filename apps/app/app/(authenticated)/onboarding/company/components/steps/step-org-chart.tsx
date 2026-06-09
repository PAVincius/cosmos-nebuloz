"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";

export type OrgChartFormData = {
  nodes: { name: string; role: string; parentName: string }[];
};

type Props = {
  defaultValues?: Partial<OrgChartFormData>;
  onChange: (data: OrgChartFormData) => void;
};

export function StepOrgChart({ defaultValues, onChange }: Props) {
  const [data, setData] = useState<OrgChartFormData>({
    nodes: defaultValues?.nodes ?? [{ name: "", role: "", parentName: "" }],
  });

  function update(nodes: OrgChartFormData["nodes"]) {
    const next = { nodes };
    setData(next);
    onChange(next);
  }

  function updateNode(i: number, patch: Partial<OrgChartFormData["nodes"][0]>) {
    update(data.nodes.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <UsersIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="font-semibold text-lg">Organograma mínimo</h2>
          <p className="text-muted-foreground text-sm">
            Opcional. Lideranças e hierarquia básica. Pode ser expandido depois.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 px-1 font-medium text-muted-foreground text-xs">
          <span>Nome</span>
          <span>Cargo</span>
          <span>Manager (nome)</span>
        </div>
        {data.nodes.map((node, i) => (
          <div className="grid grid-cols-3 items-center gap-2" key={i}>
            <Input
              onChange={(e) => updateNode(i, { name: e.target.value })}
              placeholder="Nome"
              value={node.name}
            />
            <Input
              onChange={(e) => updateNode(i, { role: e.target.value })}
              placeholder="ex: CTO"
              value={node.role}
            />
            <div className="flex gap-1">
              <Input
                onChange={(e) => updateNode(i, { parentName: e.target.value })}
                placeholder="Nome do manager"
                value={node.parentName}
              />
              {data.nodes.length > 1 && (
                <Button
                  onClick={() => update(data.nodes.filter((_, j) => j !== i))}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          className="w-fit"
          onClick={() =>
            update([...data.nodes, { name: "", role: "", parentName: "" }])
          }
          size="sm"
          variant="outline"
        >
          <PlusIcon className="mr-1 h-3.5 w-3.5" /> Pessoa
        </Button>
      </div>
    </div>
  );
}
