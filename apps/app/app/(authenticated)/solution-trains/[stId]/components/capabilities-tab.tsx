"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
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
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createCapability,
  deleteCapability,
  reorderCapabilities,
  updateCapability,
} from "../../../../actions/capabilities";

// ─── Types ───────────────────────────────────────────────────────────────────

type Capability = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
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

// ─── Capability Form Dialog ───────────────────────────────────────────────────

function CapabilityDialog({
  solutionTrainId,
  capability,
  trigger,
  onSuccess,
}: {
  solutionTrainId: string;
  capability?: Capability;
  trigger: React.ReactNode;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(capability?.title ?? "");
  const [description, setDescription] = useState(capability?.description ?? "");
  const [status, setStatus] = useState(capability?.status ?? "BACKLOG");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        if (capability) {
          await updateCapability(capability.id, {
            title,
            description: description || undefined,
            status,
          });
        } else {
          await createCapability({
            solutionTrainId,
            title,
            description: description || undefined,
            status,
          });
        }
        setOpen(false);
        if (!capability) {
          setTitle("");
          setDescription("");
          setStatus("BACKLOG");
        }
        onSuccess();
      } catch {
        setError("Erro ao salvar capability. Tente novamente.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {capability ? "Editar Capability" : "Nova Capability"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cap-title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              id="cap-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Pagamentos em tempo real..."
              value={title}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cap-description">Descrição</Label>
            <Textarea
              id="cap-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a capability..."
              rows={3}
              value={description}
            />
          </div>

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
            {isPending ? "Salvando..." : capability ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CapabilitiesTab({
  solutionTrainId,
  initialCapabilities,
}: {
  solutionTrainId: string;
  initialCapabilities: Capability[];
}) {
  const router = useRouter();
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function moveUp(index: number) {
    if (index === 0) {
      return;
    }
    const next = [...capabilities];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setCapabilities(next);
    startTransition(async () => {
      await reorderCapabilities(next.map((c) => c.id));
    });
  }

  function moveDown(index: number) {
    if (index === capabilities.length - 1) {
      return;
    }
    const next = [...capabilities];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setCapabilities(next);
    startTransition(async () => {
      await reorderCapabilities(next.map((c) => c.id));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCapability(id);
      setCapabilities((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CapabilityDialog
          onSuccess={refresh}
          solutionTrainId={solutionTrainId}
          trigger={
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              Nova Capability
            </Button>
          }
        />
      </div>

      {capabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <ZapIcon className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            Nenhuma capability adicionada ainda.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {capabilities.map((cap, index) => (
            <div
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
              key={cap.id}
            >
              <div className="flex flex-col gap-0.5">
                <Button
                  className="h-6 w-6"
                  disabled={index === 0 || isPending}
                  onClick={() => moveUp(index)}
                  size="icon"
                  variant="ghost"
                >
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  className="h-6 w-6"
                  disabled={index === capabilities.length - 1 || isPending}
                  onClick={() => moveDown(index)}
                  size="icon"
                  variant="ghost"
                >
                  <ArrowDownIcon className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{cap.title}</p>
                {cap.description && (
                  <p className="truncate text-muted-foreground text-xs">
                    {cap.description}
                  </p>
                )}
              </div>

              <Badge variant={STATUS_COLORS[cap.status] ?? "secondary"}>
                {STATUS_OPTIONS.find((o) => o.value === cap.status)?.label ??
                  cap.status}
              </Badge>

              <div className="flex gap-1">
                <CapabilityDialog
                  capability={cap}
                  onSuccess={refresh}
                  solutionTrainId={solutionTrainId}
                  trigger={
                    <Button className="h-8 w-8" size="icon" variant="ghost">
                      <PencilIcon className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <Button
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleDelete(cap.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
