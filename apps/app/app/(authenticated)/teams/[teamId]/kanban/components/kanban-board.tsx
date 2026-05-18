"use client";

import { useState, useTransition } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  ZapIcon,
  UserIcon,
  PlusIcon,
} from "lucide-react";
import { updateStoryStatus, createStory } from "@/app/actions/stories";

type Story = {
  id: string;
  title: string;
  storyPoints: number;
  status: string;
  priority: string;
  assigneeUserId: string | null;
};

interface KanbanBoardProps {
  stories: Story[];
  sprintId: string;
}

const COLUMNS: { key: string; label: string }[] = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "TODO", label: "A Fazer" },
  { key: "IN_PROGRESS", label: "Em Progresso" },
  { key: "REVIEW", label: "Revisão" },
  { key: "DONE", label: "Concluído" },
];

const COLUMN_KEYS = COLUMNS.map((c) => c.key);

const PRIORITY_BADGES: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

// ─── Create Story Dialog ──────────────────────────────────────────────────────

interface CreateStoryDialogProps {
  sprintId: string;
  defaultStatus?: string;
  onCreated: (story: Story) => void;
}

function CreateStoryDialog({ sprintId, defaultStatus = "BACKLOG", onCreated }: CreateStoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState(defaultStatus);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title"));
    const storyPoints = form.get("storyPoints") ? Number(form.get("storyPoints")) : 1;

    startTransition(async () => {
      const result = await createStory({
        sprintId,
        title,
        storyPoints,
        priority,
        status,
      });
      if (!result.ok) {
        alert(result.error);
        return;
      }
      onCreated({
        id: result.data.id,
        title,
        storyPoints,
        status,
        priority,
        assigneeUserId: null,
      });
      setOpen(false);
      setPriority("medium");
      setStatus(defaultStatus);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs text-muted-foreground border border-dashed hover:border-solid mt-1"
        >
          <PlusIcon className="h-3 w-3 mr-1" />
          Nova Story
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Story</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              name="title"
              placeholder="Como usuário, quero..."
              required
              maxLength={255}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="storyPoints">Story Points</Label>
              <Input
                id="storyPoints"
                name="storyPoints"
                type="number"
                min={0}
                max={100}
                defaultValue={1}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="low">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Coluna inicial</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((col) => (
                  <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

export function KanbanBoard({ stories: initialStories, sprintId }: KanbanBoardProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [isPending, startTransition] = useTransition();

  function moveStory(storyId: string, direction: "forward" | "back", currentStatus: string) {
    const currentIdx = COLUMN_KEYS.indexOf(currentStatus);
    const nextIdx = direction === "forward" ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx < 0 || nextIdx >= COLUMN_KEYS.length) return;

    const nextStatus = COLUMN_KEYS[nextIdx];

    // Optimistic update
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, status: nextStatus } : s)),
    );

    startTransition(async () => {
      const result = await updateStoryStatus(storyId, nextStatus);
      if (!result.ok) {
        // Revert on failure
        setStories((prev) =>
          prev.map((s) => (s.id === storyId ? { ...s, status: currentStatus } : s)),
        );
        alert(result.error);
      }
    });
  }

  function handleStoryCreated(story: Story) {
    setStories((prev) => [...prev, story]);
  }

  return (
    <div className="grid grid-cols-5 gap-3 min-h-[400px]">
      {COLUMNS.map((col, colIdx) => {
        const colStories = stories.filter((s) => s.status === col.key);

        return (
          <div key={col.key} className="flex flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center justify-between rounded-t-lg bg-muted/50 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {col.label}
              </span>
              <Badge variant="secondary" className="text-xs h-5 min-w-5 justify-center">
                {colStories.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              {colStories.map((story) => (
                <Card key={story.id} className="shadow-none">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm font-medium leading-snug">
                      {story.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <Badge
                        variant={PRIORITY_BADGES[story.priority] ?? "secondary"}
                        className="text-xs h-5"
                      >
                        {PRIORITY_LABELS[story.priority] ?? story.priority}
                      </Badge>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <ZapIcon className="h-3 w-3" />
                        {story.storyPoints} SP
                      </span>
                      {story.assigneeUserId && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          <span className="truncate max-w-[60px]">{story.assigneeUserId.slice(0, 8)}</span>
                        </span>
                      )}
                    </div>
                    {/* Move buttons */}
                    <div className="flex items-center gap-1">
                      {colIdx > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          disabled={isPending}
                          onClick={() => moveStory(story.id, "back", story.status)}
                          aria-label="Mover para coluna anterior"
                        >
                          <ArrowLeftIcon className="h-3 w-3" />
                        </Button>
                      )}
                      {colIdx < COLUMN_KEYS.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs ml-auto"
                          disabled={isPending}
                          onClick={() => moveStory(story.id, "forward", story.status)}
                          aria-label="Mover para próxima coluna"
                        >
                          <ArrowRightIcon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {colStories.length === 0 && (
                <div className="flex-1 rounded-lg border border-dashed min-h-[80px]" />
              )}
              {/* Add story button per column */}
              <CreateStoryDialog
                sprintId={sprintId}
                defaultStatus={col.key}
                onCreated={handleStoryCreated}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
