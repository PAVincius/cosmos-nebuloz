"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon, Trash2Icon, BuildingIcon } from "lucide-react";

export interface SectorsFormData {
  departments: { name: string }[];
  businessUnits: { name: string }[];
}

interface Props {
  defaultValues?: Partial<SectorsFormData>;
  onChange: (data: SectorsFormData) => void;
}

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
          <h2 className="text-lg font-semibold">Setores e Unidades de Negócio</h2>
          <p className="text-sm text-muted-foreground">
            Opcional. Pode ser configurado depois.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Departamentos</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                update({ departments: [...data.departments, { name: "" }] })
              }
            >
              <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {data.departments.map((d, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={d.name}
                onChange={(e) =>
                  update({
                    departments: data.departments.map((x, j) =>
                      j === i ? { name: e.target.value } : x
                    ),
                  })
                }
                placeholder="ex: Engenharia, Produto, Marketing"
              />
              {data.departments.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({
                      departments: data.departments.filter((_, j) => j !== i),
                    })
                  }
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
              size="sm"
              variant="outline"
              onClick={() =>
                update({ businessUnits: [...data.businessUnits, { name: "" }] })
              }
            >
              <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {data.businessUnits.map((bu, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={bu.name}
                onChange={(e) =>
                  update({
                    businessUnits: data.businessUnits.map((x, j) =>
                      j === i ? { name: e.target.value } : x
                    ),
                  })
                }
                placeholder="ex: Varejo, B2B, Fintech"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update({
                    businessUnits: data.businessUnits.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {data.businessUnits.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma unidade adicionada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
