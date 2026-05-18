"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLinkIcon,
  GripVerticalIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  createStrategicTheme,
  deleteStrategicTheme,
  linkEpicToTheme,
  reorderThemes,
  updateStrategicTheme,
} from "@/app/actions/strategic-themes";
import type {
  EpicForTheme,
  ThemeListItem,
} from "@/app/actions/strategic-themes/schema";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
] as const;

const THEME_TYPES = [
  { value: "GROWTH",              label: "Crescimento" },
  { value: "EFFICIENCY",          label: "Eficiência Operacional" },
  { value: "INNOVATION",          label: "Inovação" },
  { value: "COMPLIANCE",          label: "Compliance" },
  { value: "CUSTOMER_EXPERIENCE", label: "Experiência do Cliente" },
] as const;

const STATUS_OPTIONS = [
  { value: "DRAFT",    label: "Rascunho",     className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "ANALYSIS", label: "Em Análise",   className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  { value: "APPROVED", label: "Aprovado",     className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  { value: "ACTIVE",   label: "Ativo",        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  { value: "CLOSING",  label: "Encerrando",   className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
  { value: "ARCHIVED", label: "Arquivado",    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" },
] as const;

const EPIC_STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ACTIVE:  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  DONE:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

function statusBadge(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? STATUS_OPTIONS[0];
}

// ─── Form ────────────────────────────────────────────────────────────────────

type ThemeForm = {
  title:       string;
  description: string;
  color:       string;
  horizon:     string;
  themeType:   string;
  code:        string;
};

const EMPTY_FORM: ThemeForm = {
  title: "", description: "", color: "#6366f1",
  horizon: "", themeType: "", code: "",
};

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  initialThemes: ThemeListItem[];
  initialEpics:  EpicForTheme[];
};

// ─── Theme Card ──────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  epics,
  allEpics,
  onEdit,
  onDelete,
  onLink,
}: {
  theme: ThemeListItem;
  epics: EpicForTheme[];
  allEpics: EpicForTheme[];
  onEdit: (theme: ThemeListItem) => void;
  onDelete: (id: string) => void;
  onLink: (epicId: string, themeId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: theme.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [expanded, setExpanded] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedEpicId, setSelectedEpicId] = useState("");

  const linked = epics.filter((e) => e.strategicThemeId === theme.id);
  const unlinked = allEpics.filter((e) => e.strategicThemeId !== theme.id);
  const doneCount = linked.filter((e) => e.statusId === "DONE").length;
  const progress = linked.length === 0 ? 0 : Math.round((doneCount / linked.length) * 100);
  const sb = statusBadge(theme.status);

  function handleLink() {
    if (!selectedEpicId) return;
    onLink(selectedEpicId, theme.id);
    setSelectedEpicId("");
    setLinking(false);
  }

  return (
    <Card ref={setNodeRef} style={style} className={`overflow-hidden ${isDragging ? "opacity-50" : ""}`}>
      <div className="h-1.5 w-full" style={{ backgroundColor: theme.color }} aria-hidden />
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              {...attributes}
              {...listeners}
              type="button"
              aria-label="Reordenar"
              className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
            >
              <GripVerticalIcon className="h-4 w-4" />
            </button>
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: theme.color }} aria-hidden />
            <Link
              href={`/portfolio/themes/${theme.id}`}
              className="font-semibold text-sm leading-tight truncate hover:underline"
            >
              {theme.title}
            </Link>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(theme)}
              aria-label="Editar tema"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(theme.id)}
              aria-label="Excluir tema"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {theme.code && (
            <span className="text-[10px] font-mono uppercase text-muted-foreground/80">{theme.code}</span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sb.className}`}>{sb.label}</span>
          {theme.horizon && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{theme.horizon}</span>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {theme.epicCount} épico{theme.epicCount !== 1 && "s"}
          </Badge>
          {theme.okrCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {theme.okrCount} OKR{theme.okrCount !== 1 && "s"}
            </Badge>
          )}
        </div>
        {theme.description && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{theme.description}</p>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Progress bar */}
        {linked.length > 0 && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>{doneCount}/{linked.length} épicos concluídos</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, backgroundColor: theme.color }}
                aria-hidden
              />
            </div>
          </div>
        )}

        {linked.length > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? "Ocultar épicos" : "Ver épicos vinculados"}
          </button>
        )}

        {expanded && (
          <div className="space-y-1.5">
            {linked.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum épico vinculado.</p>
            ) : (
              linked.map((epic) => (
                <div
                  key={epic.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
                >
                  <span className="text-xs font-medium truncate">{epic.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${EPIC_STATUS_COLORS[epic.statusId] ?? EPIC_STATUS_COLORS.BACKLOG}`}>
                      {epic.statusId}
                    </span>
                    <button
                      type="button"
                      onClick={() => onLink(epic.id, null)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Desvincular épico"
                    >
                      <Trash2Icon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {linking ? (
          <div className="flex gap-2">
            <Select value={selectedEpicId} onValueChange={setSelectedEpicId}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Selecionar épico..." />
              </SelectTrigger>
              <SelectContent>
                {unlinked.length === 0 ? (
                  <SelectItem value="__none" disabled>Todos os épicos já vinculados</SelectItem>
                ) : (
                  unlinked.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs" onClick={handleLink} disabled={!selectedEpicId}>Vincular</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setLinking(false)}>Cancelar</Button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setLinking(true)}>
              <LinkIcon className="h-3 w-3 mr-1" /> {linked.length === 0 ? "Vincular primeiro épico" : "Vincular épico"}
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-7 w-7" aria-label="Abrir tema">
              <Link href={`/portfolio/themes/${theme.id}`}>
                <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Board ──────────────────────────────────────────────────────────────

export function ThemesBoard({ initialThemes, initialEpics }: Props) {
  const [themes, setThemes] = useState(initialThemes);
  const [epics, setEpics] = useState(initialEpics);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ThemeForm>(EMPTY_FORM);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return themes.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (typeFilter   !== "ALL" && (t.themeType ?? "") !== typeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.code?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [themes, search, statusFilter, typeFilter]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(t: ThemeListItem) {
    setEditingId(t.id);
    setForm({
      title:       t.title,
      description: t.description ?? "",
      color:       t.color,
      horizon:     t.horizon ?? "",
      themeType:   t.themeType ?? "",
      code:        "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;

    const payload = {
      title:       form.title,
      description: form.description || undefined,
      color:       form.color,
      horizon:     form.horizon || undefined,
      themeType:   form.themeType || undefined,
      code:        form.code || undefined,
    };

    if (editingId) {
      setThemes((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                title:       form.title,
                description: form.description || null,
                color:       form.color,
                horizon:     form.horizon || null,
                themeType:   form.themeType || null,
              }
            : t,
        ),
      );
      const id = editingId;
      startTransition(() => { void updateStrategicTheme(id, payload); });
    } else {
      const optimistic: ThemeListItem = {
        id:          `tmp-${Date.now()}`,
        code:        form.code || null,
        title:       form.title,
        description: form.description || null,
        color:       form.color,
        order:       themes.length,
        status:      "DRAFT",
        horizon:     form.horizon || null,
        themeType:   form.themeType || null,
        ownerUserId: null,
        epicCount:   0,
        okrCount:    0,
      };
      setThemes((prev) => [...prev, optimistic]);
      startTransition(() => { void createStrategicTheme(payload); });
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleDelete(id: string) {
    if (!confirm("Excluir este tema estratégico? Os épicos vinculados serão desvinculados.")) return;
    setThemes((prev) => prev.filter((t) => t.id !== id));
    setEpics((prev) => prev.map((e) => (e.strategicThemeId === id ? { ...e, strategicThemeId: null } : e)));
    startTransition(() => { void deleteStrategicTheme(id); });
  }

  function handleLink(epicId: string, themeId: string | null) {
    setEpics((prev) => prev.map((e) => (e.id === epicId ? { ...e, strategicThemeId: themeId } : e)));
    setThemes((prev) =>
      prev.map((t) => {
        const wasLinked = epics.find((e) => e.id === epicId)?.strategicThemeId === t.id;
        let count = t.epicCount;
        if (themeId === t.id && !wasLinked) count += 1;
        if (wasLinked && themeId !== t.id) count = Math.max(0, count - 1);
        return count === t.epicCount ? t : { ...t, epicCount: count };
      }),
    );
    startTransition(() => { void linkEpicToTheme(epicId, themeId); });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex((t) => t.id === active.id);
    const newIndex = filtered.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(filtered, oldIndex, newIndex);
    // Re-merge into global themes order
    const ids = new Set(reordered.map((t) => t.id));
    const others = themes.filter((t) => !ids.has(t.id));
    const next = [...reordered, ...others];
    setThemes(next);
    startTransition(() => { void reorderThemes(next.map((t) => t.id)); });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar temas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos tipos</SelectItem>
              {THEME_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} / {themes.length} tema{themes.length !== 1 && "s"}
          </p>
          <Button onClick={openCreate} size="sm">
            <PlusIcon className="h-4 w-4 mr-1.5" /> Novo Tema
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <TagIcon className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-sm">
              {themes.length === 0 ? "Nenhum tema estratégico" : "Nenhum tema corresponde aos filtros"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {themes.length === 0
                ? "Crie temas para organizar e alinhar seus épicos com a estratégia."
                : "Ajuste a busca ou filtros para ver mais resultados."}
            </p>
          </div>
          {themes.length === 0 && (
            <Button onClick={openCreate} size="sm">
              <PlusIcon className="h-4 w-4 mr-1.5" /> Criar primeiro tema
            </Button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((t) => t.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
              {filtered.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  epics={epics}
                  allEpics={epics}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onLink={handleLink}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Tema Estratégico" : "Novo Tema Estratégico"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Experiência do Cliente"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            {!editingId && (
              <div className="grid gap-1">
                <Label>Código (opcional)</Label>
                <Input
                  placeholder="Ex: THEME-001"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>
            )}

            <div className="grid gap-1">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva o objetivo estratégico..."
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Horizonte</Label>
                <Input
                  placeholder="Ex: 2026, H1 2026"
                  value={form.horizon}
                  onChange={(e) => setForm({ ...form, horizon: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Tipo</Label>
                <Select
                  value={form.themeType}
                  onValueChange={(v) => setForm({ ...form, themeType: v === "__none" ? "" : v })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {THEME_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-7 w-10 cursor-pointer rounded border border-border p-0.5"
                  aria-label="Cor personalizada"
                />
                <span className="text-xs font-mono text-muted-foreground">{form.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending || !form.title.trim()}>
              {editingId ? "Salvar" : "Criar Tema"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
