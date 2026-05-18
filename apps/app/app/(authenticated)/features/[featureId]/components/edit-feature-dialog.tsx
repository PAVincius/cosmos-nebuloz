"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { PencilIcon } from "lucide-react";
import { updateFeature } from "@/app/actions/features";
import { useRouter } from "next/navigation";

const FEATURE_STATUSES = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "ANALYSIS", label: "Em Análise" },
  { value: "REVIEW", label: "Em Revisão" },
  { value: "IMPLEMENTING", label: "Implementando" },
  { value: "DONE", label: "Concluído" },
] as const;

interface EditFeatureDialogProps {
  feature: {
    id: string;
    title: string;
    statusId: string;
    storyPoints: number;
    bv: number;
    tc: number;
    rr: number;
    js: number;
  };
}

export function EditFeatureDialog({ feature }: EditFeatureDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: feature.title,
    statusId: feature.statusId,
    storyPoints: feature.storyPoints,
    bv: feature.bv,
    tc: feature.tc,
    rr: feature.rr,
    js: feature.js,
  });

  function handleChange(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateFeature(feature.id, {
          title: form.title,
          statusId: form.statusId,
          storyPoints: Number(form.storyPoints),
          bv: Number(form.bv),
          tc: Number(form.tc),
          rr: Number(form.rr),
          js: Number(form.js),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar feature.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilIcon className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Feature</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statusId">Status</Label>
            <Select value={form.statusId} onValueChange={(v) => handleChange("statusId", v)}>
              <SelectTrigger id="statusId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEATURE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="storyPoints">Story Points</Label>
            <Input
              id="storyPoints"
              type="number"
              min={1}
              max={999}
              value={form.storyPoints}
              onChange={(e) => handleChange("storyPoints", e.target.valueAsNumber)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bv">Business Value (BV)</Label>
              <Input
                id="bv"
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={form.bv}
                onChange={(e) => handleChange("bv", e.target.valueAsNumber)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tc">Time Criticality (TC)</Label>
              <Input
                id="tc"
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={form.tc}
                onChange={(e) => handleChange("tc", e.target.valueAsNumber)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rr">Risk Reduction (RR)</Label>
              <Input
                id="rr"
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={form.rr}
                onChange={(e) => handleChange("rr", e.target.valueAsNumber)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="js">Job Size (JS)</Label>
              <Input
                id="js"
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={form.js}
                onChange={(e) => handleChange("js", e.target.valueAsNumber)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
