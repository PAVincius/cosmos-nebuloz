"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
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
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { createStory, updateStoryStatus } from "@/app/actions/stories";

type Story = {
  id: string;
  title: string;
  storyPoints: number;
  status: string;
  priority: string;
  assigneeUserId: string | null;
};

type KanbanMember = { id: string; name: string; avatar: string | null };

type KanbanBoardProps = {
  stories: Story[];
  sprintId: string;
  members?: KanbanMember[];
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "TODO", label: "A Fazer" },
  { key: "IN_PROGRESS", label: "Em Progresso" },
  { key: "REVIEW", label: "Revisão" },
  { key: "DONE", label: "Concluído" },
];

const COLUMN_KEYS = COLUMNS.map((c) => c.key);

const PRIORITY_BADGES: Record<
  string,
  "destructive" | "default" | "secondary" | "outline"
> = {
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

type CreateStoryDialogProps = {
  sprintId: string;
  defaultStatus?: string;
  onCreated: (story: Story) => void;
  members?: KanbanMember[];
};

function CreateStoryDialog({
  sprintId,
  defaultStatus = "BACKLOG",
  onCreated,
  members = [],
}: CreateStoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState(defaultStatus);
  const [assigneeUserId, setAssigneeUserId] = useState<string>("NONE");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title"));
    const storyPoints = form.get("storyPoints")
      ? Number(form.get("storyPoints"))
      : 1;
    const resolvedAssignee = assigneeUserId === "NONE" ? null : assigneeUserId;

    startTransition(async () => {
      const result = await createStory({
        sprintId,
        title,
        storyPoints,
        priority,
        status,
        assigneeUserId: resolvedAssignee,
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
        assigneeUserId: resolvedAssignee,
      });
      setOpen(false);
      setPriority("medium");
      setStatus(defaultStatus);
      setAssigneeUserId("NONE");
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="mt-1 h-7 w-full border border-dashed text-muted-foreground text-xs hover:border-solid"
          size="sm"
          variant="ghost"
        >
          <PlusIcon className="mr-1 h-3 w-3" />
          Nova Story
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Story</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              maxLength={255}
              name="title"
              placeholder="Como usuário, quero..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="storyPoints">Story Points</Label>
              <Input
                defaultValue={1}
                id="storyPoints"
                max={100}
                min={0}
                name="storyPoints"
                type="number"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Prioridade</Label>
              <Select onValueChange={setPriority} value={priority}>
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
          {members.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Responsável</Label>
              <Select onValueChange={setAssigneeUserId} value={assigneeUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem responsável</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Coluna inicial</Label>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((col) => (
                  <SelectItem key={col.key} value={col.key}>
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

export function KanbanBoard({
  stories: initialStories,
  sprintId,
  members = [],
}: KanbanBoardProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [isPending, startTransition] = useTransition();
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");

  const memberById = new Map(members.map((m) => [m.id, m]));

  function moveStory(
    storyId: string,
    direction: "forward" | "back",
    currentStatus: string
  ) {
    const currentIdx = COLUMN_KEYS.indexOf(currentStatus);
    const nextIdx = direction === "forward" ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx < 0 || nextIdx >= COLUMN_KEYS.length) {
      return;
    }

    const nextStatus = COLUMN_KEYS[nextIdx];

    // Optimistic update
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, status: nextStatus } : s))
    );

    startTransition(async () => {
      const result = await updateStoryStatus(storyId, nextStatus);
      if (!result.ok) {
        // Revert on failure
        setStories((prev) =>
          prev.map((s) =>
            s.id === storyId ? { ...s, status: currentStatus } : s
          )
        );
        alert(result.error);
      }
    });
  }

  function handleStoryCreated(story: Story) {
    setStories((prev) => [...prev, story]);
  }

  const visibleStories =
    assigneeFilter === "ALL"
      ? stories
      : stories.filter((s) => s.assigneeUserId === assigneeFilter);

  return (
    <div className="flex flex-col gap-4">
      {members.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Filtrar por:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              className={`rounded-full border px-3 py-0.5 font-medium text-xs transition-colors ${assigneeFilter === "ALL" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
              onClick={() => setAssigneeFilter("ALL")}
              type="button"
            >
              Todos
            </button>
            {members.map((m) => (
              <button
                className={`rounded-full border px-3 py-0.5 font-medium text-xs transition-colors ${assigneeFilter === m.id ? "border-[#5e6ad2] bg-[#5e6ad2]/10 text-[#5e6ad2]" : "border-border hover:bg-muted"}`}
                key={m.id}
                onClick={() => setAssigneeFilter(m.id)}
                type="button"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="grid min-h-[400px] min-w-[800px] grid-cols-5 gap-3">
          {COLUMNS.map((col, colIdx) => {
            const colStories = visibleStories.filter(
              (s) => s.status === col.key
            );

            return (
              <div className="flex flex-col gap-2" key={col.key}>
                {/* Column header */}
                <div className="flex items-center justify-between rounded-t-lg bg-muted/50 px-3 py-2">
                  <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {col.label}
                  </span>
                  <Badge
                    className="h-5 min-w-5 justify-center text-xs"
                    variant="secondary"
                  >
                    {colStories.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-2">
                  {colStories.map((story) => {
                    const priorityBorder =
                      story.priority === "critical"
                        ? "var(--red-c, rgb(239,68,68))"
                        : story.priority === "high"
                          ? "var(--amber-c, rgb(251,191,36))"
                          : "transparent";
                    return (
                      <div
                        className={cn(
                          "group relative overflow-hidden rounded-lg border border-hairline bg-card",
                          "shadow-[var(--card-shadow)] transition-all duration-200 ease-out",
                          "hover:-translate-y-[1px] hover:border-hairline-strong hover:shadow-[var(--hover-shadow)]",
                          "dark:bg-[var(--surface-3)]"
                        )}
                        key={story.id}
                      >
                        {/* Priority left strip */}
                        <div
                          className="absolute top-0 left-0 h-full w-[3px]"
                          style={{ backgroundColor: priorityBorder }}
                        />
                        <div className="pt-2.5 pr-3 pb-2 pl-2.5">
                          <p className="font-medium text-[13px] text-foreground leading-snug">
                            {story.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge
                              className="h-5 text-xs"
                              variant={
                                PRIORITY_BADGES[story.priority] ?? "secondary"
                              }
                            >
                              {PRIORITY_LABELS[story.priority] ??
                                story.priority}
                            </Badge>
                            <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
                              <ZapIcon className="h-3 w-3" />
                              {story.storyPoints} SP
                            </span>
                            {story.assigneeUserId && (
                              <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
                                <UserIcon className="h-3 w-3" />
                                <span className="max-w-[80px] truncate">
                                  {memberById.get(story.assigneeUserId)?.name ??
                                    story.assigneeUserId.slice(0, 8)}
                                </span>
                              </span>
                            )}
                          </div>
                          {/* Move buttons — reveal on hover */}
                          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            {colIdx > 0 && (
                              <Button
                                aria-label="Mover para coluna anterior"
                                className="h-6 px-1.5 text-xs"
                                disabled={isPending}
                                onClick={() =>
                                  moveStory(story.id, "back", story.status)
                                }
                                size="sm"
                                variant="ghost"
                              >
                                <ArrowLeftIcon className="h-3 w-3" />
                              </Button>
                            )}
                            {colIdx < COLUMN_KEYS.length - 1 && (
                              <Button
                                aria-label="Mover para próxima coluna"
                                className="ml-auto h-6 px-1.5 text-xs"
                                disabled={isPending}
                                onClick={() =>
                                  moveStory(story.id, "forward", story.status)
                                }
                                size="sm"
                                variant="ghost"
                              >
                                <ArrowRightIcon className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {colStories.length === 0 && (
                    <div className="min-h-[80px] flex-1 rounded-lg border border-dashed" />
                  )}
                  {/* Add story button per column */}
                  <CreateStoryDialog
                    defaultStatus={col.key}
                    members={members}
                    onCreated={handleStoryCreated}
                    sprintId={sprintId}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
