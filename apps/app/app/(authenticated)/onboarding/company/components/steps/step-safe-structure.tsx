"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { PlusIcon, TrainFrontIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

export type ARTDraft = {
  name: string;
  cadence: number;
};

export type ValueStreamDraft = {
  name: string;
  arts: ARTDraft[];
};

export type SafeStructureFormData = {
  portfolioName: string;
  portfolioDescription: string;
  valueStreams: ValueStreamDraft[];
};

type Props = {
  defaultValues?: Partial<SafeStructureFormData>;
  onChange: (data: SafeStructureFormData) => void;
};

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

  function updateART(vsIdx: number, artIdx: number, patch: Partial<ARTDraft>) {
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
          <h2 className="font-semibold text-lg">Estrutura SAFe</h2>
          <p className="text-muted-foreground text-sm">
            Defina o portfólio, value streams e ARTs. Você pode adicionar mais
            depois.
          </p>
        </div>
      </div>

      {/* Portfolio */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="pname">
          Nome do portfólio <span className="text-destructive">*</span>
        </Label>
        <Input
          autoFocus
          id="pname"
          onChange={(e) => update({ portfolioName: e.target.value })}
          placeholder="ex: Portfólio Digital"
          value={data.portfolioName}
        />
        <Textarea
          onChange={(e) => update({ portfolioDescription: e.target.value })}
          placeholder="Descrição opcional"
          rows={2}
          value={data.portfolioDescription}
        />
      </div>

      {/* Value Streams */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>
            Value Streams <span className="text-destructive">*</span>
          </Label>
          <Button onClick={addVS} size="sm" variant="outline">
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Value Stream
          </Button>
        </div>

        {data.valueStreams.map((vs, vi) => (
          <div className="flex flex-col gap-3 rounded-lg border p-4" key={vi}>
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                onChange={(e) => updateVS(vi, { name: e.target.value })}
                placeholder="ex: Pagamentos"
                value={vs.name}
              />
              {data.valueStreams.length > 1 && (
                <Button onClick={() => removeVS(vi)} size="sm" variant="ghost">
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* ARTs */}
            <div className="flex flex-col gap-2 border-l pl-3">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>ARTs neste VS</span>
                <Button
                  className="h-6 text-xs"
                  onClick={() => addART(vi)}
                  size="sm"
                  variant="ghost"
                >
                  <PlusIcon className="mr-1 h-3 w-3" /> ART
                </Button>
              </div>
              {vs.arts.map((art, ai) => (
                <div className="flex items-center gap-2" key={ai}>
                  <Input
                    className="h-8 flex-1 text-sm"
                    onChange={(e) =>
                      updateART(vi, ai, { name: e.target.value })
                    }
                    placeholder="Nome do ART"
                    value={art.name}
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 w-16 text-sm"
                      max={26}
                      min={4}
                      onChange={(e) =>
                        updateART(vi, ai, { cadence: Number(e.target.value) })
                      }
                      type="number"
                      value={art.cadence}
                    />
                    <span className="text-muted-foreground text-xs">sem</span>
                  </div>
                  {vs.arts.length > 1 && (
                    <Button
                      className="h-8 w-8 p-0"
                      onClick={() => removeART(vi, ai)}
                      size="sm"
                      variant="ghost"
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
  if (!data.portfolioName.trim()) {
    return "Nome do portfólio é obrigatório.";
  }
  for (const vs of data.valueStreams) {
    if (!vs.name.trim()) {
      return "Todos os Value Streams precisam de nome.";
    }
    for (const art of vs.arts) {
      if (!art.name.trim()) {
        return "Todos os ARTs precisam de nome.";
      }
    }
  }
  return null;
}
