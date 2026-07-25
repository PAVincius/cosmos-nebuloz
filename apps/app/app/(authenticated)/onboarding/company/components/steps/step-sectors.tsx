"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { BuildingIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

export type SectorsFormData = {
  departments: { name: string }[];
  businessUnits: { name: string }[];
};

type Props = {
  defaultValues?: Partial<SectorsFormData>;
  onChange: (data: SectorsFormData) => void;
};

export function StepSectors({ defaultValues, onChange }: Props) {
  const [data, setData] = useState<SectorsFormData>({
    departments: defaultValues?.departments ?? [{ name: "" }],
    businessUnits: defaultValues?.businessUnits ?? [],
  });

  function update(patch: Partial<SectorsFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <BuildingIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="font-semibold text-lg">
            Setores e Unidades de Negócio
          </h2>
          <p className="text-muted-foreground text-sm">
            Opcional. Pode ser configurado depois.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Departamentos</Label>
            <Button
              onClick={() =>
                update({ departments: [...data.departments, { name: "" }] })
              }
              size="sm"
              variant="outline"
            >
              <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {data.departments.map((d, i) => (
            <div className="flex gap-2" key={i}>
              <Input
                onChange={(e) =>
                  update({
                    departments: data.departments.map((x, j) =>
                      j === i ? { name: e.target.value } : x
                    ),
                  })
                }
                placeholder="ex: Engenharia, Produto, Marketing"
                value={d.name}
              />
              {data.departments.length > 1 && (
                <Button
                  onClick={() =>
                    update({
                      departments: data.departments.filter((_, j) => j !== i),
                    })
                  }
                  size="sm"
                  variant="ghost"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Unidades de Negócio</Label>
            <Button
              onClick={() =>
                update({ businessUnits: [...data.businessUnits, { name: "" }] })
              }
              size="sm"
              variant="outline"
            >
              <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {data.businessUnits.map((bu, i) => (
            <div className="flex gap-2" key={i}>
              <Input
                onChange={(e) =>
                  update({
                    businessUnits: data.businessUnits.map((x, j) =>
                      j === i ? { name: e.target.value } : x
                    ),
                  })
                }
                placeholder="ex: Varejo, B2B, Fintech"
                value={bu.name}
              />
              <Button
                onClick={() =>
                  update({
                    businessUnits: data.businessUnits.filter((_, j) => j !== i),
                  })
                }
                size="sm"
                variant="ghost"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {data.businessUnits.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Nenhuma unidade adicionada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
