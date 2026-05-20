"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@repo/design-system/components/ui/card";
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
import { useState, useTransition } from "react";
import { ExternalSourceBadge } from "@/app/(authenticated)/components/external-source-badge";
import {
  createFeature,
  deleteFeature,
  type FeatureRow,
  updateFeatureStatus,
} from "@/app/actions/features";

type Status = "BACKLOG" | "ANALYSIS" | "REVIEW" | "IMPLEMENTING" | "DONE";

const COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: "BACKLOG", label: "Backlog", color: "border-gray-200 bg-gray-50" },
  { status: "ANALYSIS", label: "Análise", color: "border-blue-200 bg-blue-50" },
  {
    status: "REVIEW",
    label: "Review",
    color: "border-yellow-200 bg-yellow-50",
  },
  {
    status: "IMPLEMENTING",
    label: "Implementando",
    color: "border-orange-200 bg-orange-50",
  },
  { status: "DONE", label: "Concluído", color: "border-green-200 bg-green-50" },
];

function WSJF_COLOR(score: number): string {
  if (score >= 10) {
    return "text-green-600";
  }
  if (score >= 5) {
    return "text-yellow-600";
  }
  return "text-muted-foreground";
}

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

  const byStatus = (status: Status) =>
    features.filter((f) => f.statusId === status);

  const totalSP = features.reduce((s, f) => s + f.storyPoints, 0);
  const done = byStatus("DONE").length;

  function handleStatusChange(id: string, statusId: string) {
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, statusId } : f))
    );
    startTransition(() => updateFeatureStatus(id, statusId, epicId));
  }

  function handleDelete(id: string) {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    startTransition(() => deleteFeature(id, epicId));
  }

  function handleCreate() {
    if (!form.title.trim()) {
      return;
    }
    const wsjfScore =
      form.bv + form.tc + form.rr > 0 && form.js > 0
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
      externalSource: null,
      externalUrl: null,
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
          <p className="text-muted-foreground text-xs">Features</p>
          <p className="font-semibold text-lg">{features.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Story Points</p>
          <p className="font-semibold text-lg">{totalSP}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Concluídas</p>
          <p className="font-semibold text-green-600 text-lg">{done}</p>
        </div>
        <Button className="ml-auto" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-1 h-4 w-4" /> Nova Feature
        </Button>
      </div>

      {/* Kanban */}
      <div className="grid min-h-[480px] grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const colFeatures = byStatus(col.status);
          return (
            <div
              className={`flex flex-col gap-2 rounded-lg border p-3 ${col.color}`}
              key={col.status}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-xs">{col.label}</span>
                <Badge className="text-xs" variant="secondary">
                  {colFeatures.length}
                </Badge>
              </div>
              {colFeatures.map((f) => (
                <FeatureCard
                  feature={f}
                  key={f.id}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {colFeatures.length === 0 && (
                <p className="py-4 text-center text-muted-foreground text-xs">
                  Vazio
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Feature — {epicTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Título</Label>
              <Input
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Nome da feature..."
                value={form.title}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Story Points</Label>
                <Input
                  max={999}
                  min={1}
                  onChange={(e) =>
                    setForm({ ...form, storyPoints: Number(e.target.value) })
                  }
                  type="number"
                  value={form.storyPoints}
                />
              </div>
              <div className="grid gap-1">
                <Label>Status inicial</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, statusId: v as Status })
                  }
                  value={form.statusId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => (
                      <SelectItem key={c.status} value={c.status}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1 font-medium text-muted-foreground text-xs">
                <ZapIcon className="h-3 w-3" /> Critérios WSJF (1-10)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(["bv", "tc", "rr", "js"] as const).map((k) => (
                  <div className="grid gap-1" key={k}>
                    <Label className="text-xs uppercase">{k}</Label>
                    <Input
                      max={10}
                      min={1}
                      onChange={(e) =>
                        setForm({ ...form, [k]: Number(e.target.value) })
                      }
                      type="number"
                      value={form[k]}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={isPending || !form.title.trim()}
              onClick={handleCreate}
            >
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
        className="cursor-pointer bg-background transition-shadow hover:shadow-sm"
        onClick={() => setOpen(true)}
      >
        <CardHeader className="p-3 pb-1">
          <div className="flex items-start justify-between gap-1.5">
            <p className="font-medium text-xs leading-tight">{feature.title}</p>
            <ExternalSourceBadge
              source={feature.externalSource}
              url={feature.externalUrl}
            />
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between p-3 pt-0">
          <span className="text-muted-foreground text-xs">
            {feature.storyPoints} SP
          </span>
          {feature.wsjfScore > 0 && (
            <span
              className={`font-mono font-semibold text-xs ${WSJF_COLOR(feature.wsjfScore)}`}
            >
              {feature.wsjfScore.toFixed(1)}
            </span>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{feature.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground">SP:</span>
              <span className="font-medium">{feature.storyPoints}</span>
              <span className="ml-2 text-muted-foreground">WSJF:</span>
              <span
                className={`font-mono font-semibold ${WSJF_COLOR(feature.wsjfScore)}`}
              >
                {feature.wsjfScore.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
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
                    onClick={() => {
                      onStatusChange(feature.id, col.status);
                      setOpen(false);
                    }}
                    size="sm"
                    variant={
                      feature.statusId === col.status ? "default" : "outline"
                    }
                  >
                    {col.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onDelete(feature.id);
                setOpen(false);
              }}
              size="sm"
              variant="outline"
            >
              <Trash2Icon className="mr-1 h-4 w-4" /> Excluir
            </Button>
            <Button onClick={() => setOpen(false)} variant="outline">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
