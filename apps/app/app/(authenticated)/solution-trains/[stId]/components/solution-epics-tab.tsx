"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { BookOpenIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSolutionEpic,
  deleteSolutionEpic,
  updateSolutionEpic,
} from "../../../../actions/solution-epics";

// ─── Types ───────────────────────────────────────────────────────────────────

type SolutionEpic = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  wsjfScore: number;
};

const STATUS_OPTIONS = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "ANALYZING", label: "Analisando" },
  { value: "IMPLEMENTING", label: "Implementando" },
  { value: "DONE", label: "Concluído" },
];

const STATUS_COLORS: Record<
  string,
  "secondary" | "default" | "destructive" | "outline"
> = {
  BACKLOG: "secondary",
  ANALYZING: "outline",
  IMPLEMENTING: "default",
  DONE: "default",
};

// ─── Epic Form Dialog ─────────────────────────────────────────────────────────

function EpicDialog({
  solutionTrainId,
  epic,
  trigger,
  onSuccess,
}: {
  solutionTrainId: string;
  epic?: SolutionEpic;
  trigger: React.ReactNode;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(epic?.title ?? "");
  const [description, setDescription] = useState(epic?.description ?? "");
  const [status, setStatus] = useState(epic?.status ?? "BACKLOG");
  const [wsjfScore, setWsjfScore] = useState(String(epic?.wsjfScore ?? "0"));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const score = Number.parseFloat(wsjfScore) || 0;
        if (epic) {
          await updateSolutionEpic(epic.id, {
            title,
            description: description || undefined,
            status,
            wsjfScore: score,
          });
        } else {
          await createSolutionEpic({
            solutionTrainId,
            title,
            description: description || undefined,
            status,
            wsjfScore: score,
          });
        }
        setOpen(false);
        if (!epic) {
          setTitle("");
          setDescription("");
          setStatus("BACKLOG");
          setWsjfScore("0");
        }
        onSuccess();
      } catch {
        setError("Erro ao salvar Solution Epic. Tente novamente.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {epic ? "Editar Solution Epic" : "Novo Solution Epic"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="epic-title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              id="epic-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Modernização da plataforma..."
              value={title}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="epic-description">Descrição</Label>
            <Textarea
              id="epic-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o Solution Epic..."
              rows={3}
              value={description}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select onValueChange={setStatus} value={status}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="epic-wsjf">WSJF Score</Label>
              <Input
                id="epic-wsjf"
                min={0}
                onChange={(e) => setWsjfScore(e.target.value)}
                placeholder="0"
                step={0.1}
                type="number"
                value={wsjfScore}
              />
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => setOpen(false)}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button disabled={isPending || !title.trim()} onClick={handleSubmit}>
            {isPending ? "Salvando..." : epic ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SolutionEpicsTab({
  solutionTrainId,
  initialEpics,
}: {
  solutionTrainId: string;
  initialEpics: SolutionEpic[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteSolutionEpic(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <EpicDialog
          onSuccess={refresh}
          solutionTrainId={solutionTrainId}
          trigger={
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              Novo Solution Epic
            </Button>
          }
        />
      </div>

      {initialEpics.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <BookOpenIcon className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            Nenhum Solution Epic adicionado ainda.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {initialEpics.map((epic) => (
            <Card className="relative" key={epic.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-tight">
                    {epic.title}
                  </CardTitle>
                  <div className="flex shrink-0 gap-1">
                    <EpicDialog
                      epic={epic}
                      onSuccess={refresh}
                      solutionTrainId={solutionTrainId}
                      trigger={
                        <Button className="h-7 w-7" size="icon" variant="ghost">
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => handleDelete(epic.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {epic.description && (
                  <CardDescription className="line-clamp-2 text-xs">
                    {epic.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge variant={STATUS_COLORS[epic.status] ?? "secondary"}>
                  {STATUS_OPTIONS.find((o) => o.value === epic.status)?.label ??
                    epic.status}
                </Badge>
                <span className="font-medium text-muted-foreground text-xs">
                  WSJF {epic.wsjfScore.toFixed(1)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
