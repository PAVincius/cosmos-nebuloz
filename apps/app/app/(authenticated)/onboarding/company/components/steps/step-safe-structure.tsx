"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { PlusIcon, Trash2Icon, TrainFrontIcon } from "lucide-react";

export interface ARTDraft {
  name: string;
  cadence: number;
}

export interface ValueStreamDraft {
  name: string;
  arts: ARTDraft[];
}

export interface SafeStructureFormData {
  portfolioName: string;
  portfolioDescription: string;
  valueStreams: ValueStreamDraft[];
}

interface Props {
  defaultValues?: Partial<SafeStructureFormData>;
  onChange: (data: SafeStructureFormData) => void;
}

export function StepSafeStructure({ defaultValues, onChange }: Props) {
  const [data, setData] = useState<SafeStructureFormData>({
    portfolioName: defaultValues?.portfolioName ?? "",
    portfolioDescription: defaultValues?.portfolioDescription ?? "",
    valueStreams: defaultValues?.valueStreams ?? [
      { name: "", arts: [{ name: "", cadence: 10 }] },
    ],
  });

  function update(patch: Partial<SafeStructureFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  function addVS() {
    update({
      valueStreams: [
        ...data.valueStreams,
        { name: "", arts: [{ name: "", cadence: 10 }] },
      ],
    });
  }

  function removeVS(i: number) {
    update({ valueStreams: data.valueStreams.filter((_, idx) => idx !== i) });
  }

  function updateVS(i: number, patch: Partial<ValueStreamDraft>) {
    update({
      valueStreams: data.valueStreams.map((vs, idx) =>
        idx === i ? { ...vs, ...patch } : vs
      ),
    });
  }

  function addART(vsIdx: number) {
    const vs = data.valueStreams[vsIdx];
    updateVS(vsIdx, { arts: [...vs.arts, { name: "", cadence: 10 }] });
  }

  function removeART(vsIdx: number, artIdx: number) {
    const vs = data.valueStreams[vsIdx];
    updateVS(vsIdx, {
      arts: vs.arts.filter((_, idx) => idx !== artIdx),
    });
  }

  function updateART(
    vsIdx: number,
    artIdx: number,
    patch: Partial<ARTDraft>
  ) {
    const vs = data.valueStreams[vsIdx];
    updateVS(vsIdx, {
      arts: vs.arts.map((a, idx) => (idx === artIdx ? { ...a, ...patch } : a)),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <TrainFrontIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Estrutura SAFe</h2>
          <p className="text-sm text-muted-foreground">
            Defina o portfólio, value streams e ARTs. Você pode adicionar mais depois.
          </p>
        </div>
      </div>

      {/* Portfolio */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="pname">
          Nome do portfólio <span className="text-destructive">*</span>
        </Label>
        <Input
          id="pname"
          value={data.portfolioName}
          onChange={(e) => update({ portfolioName: e.target.value })}
          placeholder="ex: Portfólio Digital"
          autoFocus
        />
        <Textarea
          value={data.portfolioDescription}
          onChange={(e) => update({ portfolioDescription: e.target.value })}
          placeholder="Descrição opcional"
          rows={2}
        />
      </div>

      {/* Value Streams */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>
            Value Streams <span className="text-destructive">*</span>
          </Label>
          <Button size="sm" variant="outline" onClick={addVS}>
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Value Stream
          </Button>
        </div>

        {data.valueStreams.map((vs, vi) => (
          <div key={vi} className="rounded-lg border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                value={vs.name}
                onChange={(e) => updateVS(vi, { name: e.target.value })}
                placeholder="ex: Pagamentos"
                className="flex-1"
              />
              {data.valueStreams.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeVS(vi)}
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* ARTs */}
            <div className="flex flex-col gap-2 pl-3 border-l">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>ARTs neste VS</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => addART(vi)}
                >
                  <PlusIcon className="mr-1 h-3 w-3" /> ART
                </Button>
              </div>
              {vs.arts.map((art, ai) => (
                <div key={ai} className="flex items-center gap-2">
                  <Input
                    value={art.name}
                    onChange={(e) =>
                      updateART(vi, ai, { name: e.target.value })
                    }
                    placeholder="Nome do ART"
                    className="flex-1 h-8 text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={4}
                      max={26}
                      value={art.cadence}
                      onChange={(e) =>
                        updateART(vi, ai, { cadence: Number(e.target.value) })
                      }
                      className="w-16 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">sem</span>
                  </div>
                  {vs.arts.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => removeART(vi, ai)}
                    >
                      <Trash2Icon className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function validateSafeStructure(
  data: SafeStructureFormData
): string | null {
  if (!data.portfolioName.trim()) return "Nome do portfólio é obrigatório.";
  for (const vs of data.valueStreams) {
    if (!vs.name.trim()) return "Todos os Value Streams precisam de nome.";
    for (const art of vs.arts) {
      if (!art.name.trim()) return "Todos os ARTs precisam de nome.";
    }
  }
  return null;
}
