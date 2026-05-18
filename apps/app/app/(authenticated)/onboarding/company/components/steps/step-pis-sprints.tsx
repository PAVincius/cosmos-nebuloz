"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { CalendarIcon } from "lucide-react";

export interface PISprintsFormData {
  piName: string;
  startDate: string;
  endDate: string;
  iterationCount: number;
  sprintLengthDays: number;
  artName: string;
}

interface Props {
  defaultValues?: Partial<PISprintsFormData>;
  artNames: string[];
  onChange: (data: PISprintsFormData) => void;
}

export function StepPIsSprints({ defaultValues, artNames, onChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [data, setData] = useState<PISprintsFormData>({
    piName: defaultValues?.piName ?? "PI 2026-Q3",
    startDate: defaultValues?.startDate ?? today,
    endDate: defaultValues?.endDate ?? "",
    iterationCount: defaultValues?.iterationCount ?? 5,
    sprintLengthDays: defaultValues?.sprintLengthDays ?? 14,
    artName: defaultValues?.artName ?? artNames[0] ?? "",
  });

  function update(patch: Partial<PISprintsFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  const estimatedEnd =
    data.startDate && data.iterationCount && data.sprintLengthDays
      ? new Date(
          new Date(data.startDate).getTime() +
            data.iterationCount * data.sprintLengthDays * 86_400_000
        )
          .toISOString()
          .slice(0, 10)
      : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">
            Configuração do primeiro PI
          </h2>
          <p className="text-sm text-muted-foreground">
            Defina o horizonte do Program Increment e o comprimento das sprints.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>
            Nome do PI <span className="text-destructive">*</span>
          </Label>
          <Input
            value={data.piName}
            onChange={(e) => update({ piName: e.target.value })}
            placeholder="PI 2026-Q3"
            autoFocus
          />
        </div>

        {artNames.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>
              ART <span className="text-destructive">*</span>
            </Label>
            <Select
              value={data.artName}
              onValueChange={(v) => update({ artName: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {artNames.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Data de início</Label>
          <Input
            type="date"
            value={data.startDate}
            onChange={(e) => update({ startDate: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Nº de iterações</Label>
          <Select
            value={String(data.iterationCount)}
            onValueChange={(v) => update({ iterationCount: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} sprints
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Comprimento do sprint</Label>
          <Select
            value={String(data.sprintLengthDays)}
            onValueChange={(v) => update({ sprintLengthDays: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">1 semana (7 dias)</SelectItem>
              <SelectItem value="14">2 semanas (14 dias)</SelectItem>
              <SelectItem value="21">3 semanas (21 dias)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {estimatedEnd && (
          <div className="flex flex-col gap-1.5">
            <Label>Data de término estimada</Label>
            <Input value={estimatedEnd} disabled />
          </div>
        )}
      </div>
    </div>
  );
}

export function validatePIsSprints(data: PISprintsFormData): string | null {
  if (!data.piName.trim()) return "Nome do PI é obrigatório.";
  if (!data.startDate) return "Data de início é obrigatória.";
  if (!data.artName) return "Selecione o ART.";
  return null;
}
