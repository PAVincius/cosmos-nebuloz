"use client";

import { useState, useTransition } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader } from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { PlusIcon, Trash2Icon, ZapIcon } from "lucide-react";
import {
  createFeature,
  deleteFeature,
  updateFeatureStatus,
  type FeatureRow,
} from "@/app/actions/features";

type Status = "BACKLOG" | "ANALYSIS" | "REVIEW" | "IMPLEMENTING" | "DONE";

const COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: "BACKLOG", label: "Backlog", color: "border-gray-200 bg-gray-50" },
  { status: "ANALYSIS", label: "Análise", color: "border-blue-200 bg-blue-50" },
  { status: "REVIEW", label: "Review", color: "border-yellow-200 bg-yellow-50" },
  { status: "IMPLEMENTING", label: "Implementando", color: "border-orange-200 bg-orange-50" },
  { status: "DONE", label: "Concluído", color: "border-green-200 bg-green-50" },
];

const WSJF_COLOR = (score: number) =>
  score >= 10
    ? "text-green-600"
    : score >= 5
      ? "text-yellow-600"
      : "text-muted-foreground";

type Props = {
  epicId: string;
  epicTitle: string;
  initialFeatures: FeatureRow[];
};

type FormState = {
  title: string;
  storyPoints: number;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  statusId: Status;
};

const DEFAULT_FORM: FormState = {
  title: "",
  storyPoints: 3,
  bv: 5,
  tc: 3,
  rr: 2,
  js: 3,
  statusId: "BACKLOG",
};

export function FeatureBoard({ epicId, epicTitle, initialFeatures }: Props) {
  const [features, setFeatures] = useState(initialFeatures);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  const byStatus = (status: Status) => features.filter((f) => f.statusId === status);

  const totalSP = features.reduce((s, f) => s + f.storyPoints, 0);
  const done = byStatus("DONE").length;

  function handleStatusChange(id: string, statusId: string) {
    setFeatures((prev) =>
      prev.map((f) => f.id === id ? { ...f, statusId } : f)
    );
    startTransition(() => updateFeatureStatus(id, statusId, epicId));
  }

  function handleDelete(id: string) {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    startTransition(() => deleteFeature(id, epicId));
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    const wsjfScore = form.bv + form.tc + form.rr > 0 && form.js > 0
      ? Math.round(((form.bv + form.tc + form.rr) / form.js) * 10) / 10
      : 0;

    const optimistic: FeatureRow = {
      id: `tmp-${Date.now()}`,
      title: form.title,
      statusId: form.statusId,
      storyPoints: form.storyPoints,
      bv: form.bv,
      tc: form.tc,
      rr: form.rr,
      js: form.js,
      wsjfScore,
      epicId,
      assigneeUserId: null,
      completedAt: null,
      createdAt: new Date(),
    };
    setFeatures((prev) => [optimistic, ...prev]);
    setForm(DEFAULT_FORM);
    setDialogOpen(false);

    startTransition(async () => {
      await createFeature({
        epicId,
        title: form.title,
        statusId: form.statusId,
        storyPoints: form.storyPoints,
        bv: form.bv,
        tc: form.tc,
        rr: form.rr,
        js: form.js,
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header stats */}
      <div className="flex items-center gap-6 rounded-lg border px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Features</p>
          <p className="text-lg font-semibold">{features.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Story Points</p>
          <p className="text-lg font-semibold">{totalSP}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Concluídas</p>
          <p className="text-lg font-semibold text-green-600">{done}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="ml-auto">
          <PlusIcon className="h-4 w-4 mr-1" /> Nova Feature
        </Button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-5 gap-3 min-h-[480px]">
        {COLUMNS.map((col) => {
          const colFeatures = byStatus(col.status);
          return (
            <div key={col.status} className={`rounded-lg border p-3 flex flex-col gap-2 ${col.color}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{col.label}</span>
                <Badge variant="secondary" className="text-xs">{colFeatures.length}</Badge>
              </div>
              {colFeatures.map((f) => (
                <FeatureCard
                  key={f.id}
                  feature={f}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
              {colFeatures.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Vazio</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Feature — {epicTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Título</Label>
              <Input
                placeholder="Nome da feature..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Story Points</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={form.storyPoints}
                  onChange={(e) => setForm({ ...form, storyPoints: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Status inicial</Label>
                <Select value={form.statusId} onValueChange={(v) => setForm({ ...form, statusId: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => (
                      <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <ZapIcon className="h-3 w-3" /> Critérios WSJF (1-10)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(["bv", "tc", "rr", "js"] as const).map((k) => (
                  <div key={k} className="grid gap-1">
                    <Label className="text-xs uppercase">{k}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isPending || !form.title.trim()}>
              Criar Feature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureCard({
  feature,
  onStatusChange,
  onDelete,
}: {
  feature: FeatureRow;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-sm transition-shadow bg-background"
        onClick={() => setOpen(true)}
      >
        <CardHeader className="p-3 pb-1">
          <p className="text-xs font-medium leading-tight">{feature.title}</p>
        </CardHeader>
        <CardContent className="p-3 pt-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{feature.storyPoints} SP</span>
          {feature.wsjfScore > 0 && (
            <span className={`text-xs font-mono font-semibold ${WSJF_COLOR(feature.wsjfScore)}`}>
              {feature.wsjfScore.toFixed(1)}
            </span>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{feature.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground">SP:</span>
              <span className="font-medium">{feature.storyPoints}</span>
              <span className="text-muted-foreground ml-2">WSJF:</span>
              <span className={`font-mono font-semibold ${WSJF_COLOR(feature.wsjfScore)}`}>
                {feature.wsjfScore.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>BV:{feature.bv}</span>
              <span>TC:{feature.tc}</span>
              <span>RR:{feature.rr}</span>
              <span>JS:{feature.js}</span>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Mover para</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((col) => (
                  <Button
                    key={col.status}
                    variant={feature.statusId === col.status ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      onStatusChange(feature.id, col.status);
                      setOpen(false);
                    }}
                  >
                    {col.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onDelete(feature.id);
                setOpen(false);
              }}
            >
              <Trash2Icon className="h-4 w-4 mr-1" /> Excluir
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
