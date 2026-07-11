"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
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
import { CalendarIcon, FlagIcon, LayersIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import {
  PageHeader,
  type StatItem,
} from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { createRoadmapItem, deleteRoadmapItem } from "@/app/actions/roadmap";
import type { RoadmapItemWithRelations } from "@/app/actions/roadmap/schema";
import { appDesign } from "@/lib/app-design";
import { RoadmapGantt } from "./roadmap-gantt";
import { buildFixedQuarterColumns, LEGEND, TONE_RGB } from "./roadmap-gantt-utils";

type ArtOption = { id: string; name: string };
type EpicOption = { id: string; title: string; statusId: string };

type RoadmapTimelineProps = {
  arts: ArtOption[];
  epics: EpicOption[];
  initialItems: RoadmapItemWithRelations[];
};

const CREATE_STATUS_OPTIONS = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
const CREATE_STATUS_LABEL: Record<
  (typeof CREATE_STATUS_OPTIONS)[number],
  string
> = {
  DONE: "Entregue",
  IN_PROGRESS: "Em execução",
  PLANNED: "Planejado",
};

const FILTER_STATUS_OPTIONS = [
  { label: "Planejado", value: "PLANNED" },
  { label: "Em execução", value: "IN_PROGRESS" },
  { label: "Entregue", value: "DONE" },
  { label: "Cancelado", value: "CANCELLED" },
];

type CreateFormState = {
  artId: string;
  color: string;
  description: string;
  endDate: string;
  epicId: string;
  milestone: boolean;
  startDate: string;
  status: (typeof CREATE_STATUS_OPTIONS)[number];
  title: string;
};

const EMPTY_FORM: CreateFormState = {
  artId: "",
  color: "#6366f1",
  description: "",
  endDate: "",
  epicId: "",
  milestone: false,
  startDate: "",
  status: "PLANNED",
  title: "",
};

export function RoadmapTimeline({
  arts,
  epics,
  initialItems,
}: RoadmapTimelineProps) {
  const [items, setItems] = useState(initialItems);
  const [filterArt, setFilterArt] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (filterArt === "all" || item.artId === filterArt) &&
          (filterStatus === "all" || item.status === filterStatus)
      ),
    [items, filterArt, filterStatus]
  );

  const milestonesCount = useMemo(
    () => items.filter((item) => item.milestone).length,
    [items]
  );

  const currentPILabel = useMemo(() => buildFixedQuarterColumns(4)[1].label, []);

  const stats: StatItem[] = [
    { label: "Itens no horizonte", value: items.length },
    { icon: FlagIcon, label: "Marcos", value: milestonesCount },
    { label: "PI atual", value: currentPILabel },
  ];

  function handleDelete(item: RoadmapItemWithRelations) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      const result = await deleteRoadmapItem(item.id);
      if (!result.ok) {
        setItems(previous);
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const raw = {
      artId: form.artId || undefined,
      color: form.color,
      description: form.description || undefined,
      endDate: form.endDate,
      epicId: form.epicId || undefined,
      milestone: form.milestone,
      startDate: form.startDate,
      status: form.status,
      title: form.title,
    };

    startTransition(async () => {
      const result = await createRoadmapItem(raw);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      const art = form.artId ? arts.find((a) => a.id === form.artId) : undefined;
      const epic = form.epicId
        ? epics.find((e) => e.id === form.epicId)
        : undefined;
      const created = result.data;
      const durationDays = Math.max(
        0,
        Math.round(
          (new Date(created.endDate).getTime() -
            new Date(created.startDate).getTime()) /
            86_400_000
        )
      );
      setItems((prev) => [
        ...prev,
        {
          ...created,
          art: art ? { id: art.id, name: art.name } : null,
          durationDays,
          epic: epic
            ? { id: epic.id, statusId: epic.statusId, title: epic.title }
            : null,
        },
      ]);
      setForm(EMPTY_FORM);
      setModalOpen(false);
    });
  }

  return (
    <>
      <PageHeader
        accentRgb="167,139,250"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={setFilterArt} value={filterArt}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Filtrar por ART" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ARTs</SelectItem>
                {arts.map((art) => (
                  <SelectItem key={art.id} value={art.id}>
                    {art.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setFilterStatus} value={filterStatus}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {FILTER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setFormError(null);
                setForm(EMPTY_FORM);
                setModalOpen(true);
              }}
              size="sm"
            >
              <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Novo Item
            </Button>
          </div>
        }
        breadcrumb={[
          { href: "/portfolio", label: "Portfolio" },
          { label: "Roadmap" },
        ]}
        stats={stats}
        subtitle="Entregas por ART ao longo de 4 Program Increments. Cada barra é um épico posicionado pelo PI de início e duração."
        title="Roadmap Multi-PI"
      />
      <div className={appDesign.bodyScroll}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <RelationChip
            eyebrow="Estrutura"
            href="/arts"
            icon={<LayersIcon className="h-3.5 w-3.5" />}
            label="ARTs"
          />
          <RelationChip
            eyebrow="Backlog"
            href="/epics"
            icon={<LayersIcon className="h-3.5 w-3.5" />}
            label="Épicos"
          />
          <RelationChip
            eyebrow="Execução"
            href="/pi-planning"
            icon={<LayersIcon className="h-3.5 w-3.5" />}
            label="PI Planning"
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          {LEGEND.map((entry) => (
            <div className="flex items-center gap-1.5" key={entry.label}>
              <span
                aria-hidden
                style={{
                  background: `rgb(${TONE_RGB[entry.tone]})`,
                  borderRadius: "50%",
                  height: 7,
                  width: 7,
                }}
              />
              <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                {entry.label}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <FlagIcon
              className="h-3 w-3"
              style={{ color: "var(--amber-text)" }}
            />
            <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>
              Marco
            </span>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div
            className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center"
            style={{
              border: "1px dashed var(--hairline-strong)",
              borderRadius: "var(--cosmos-r-lg)",
            }}
          >
            <CalendarIcon
              className="h-9 w-9"
              style={{ color: "var(--ink-faint)" }}
            />
            <p style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>
              {items.length === 0
                ? "Nenhum item de roadmap cadastrado ainda."
                : "Nenhum item corresponde aos filtros selecionados."}
            </p>
            {items.length === 0 && (
              <Button
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setModalOpen(true);
                }}
                size="sm"
                variant="secondary"
              >
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Adicionar item
              </Button>
            )}
          </div>
        ) : (
          <RoadmapGantt arts={arts} items={filteredItems} onDelete={handleDelete} />
        )}
      </div>

      <ModalShell
        eyebrow="Posiciona uma entrega por ART e Program Increment"
        footer={
          <>
            <Button
              onClick={() => setModalOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={isPending} form="roadmap-create-form" type="submit">
              {isPending ? "Salvando…" : "Criar item"}
            </Button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="Novo item de roadmap"
      >
        <form
          className="space-y-4"
          id="roadmap-create-form"
          onSubmit={handleSubmit}
        >
          {formError && (
            <p style={{ color: "var(--red-text)", fontSize: 12.5 }}>
              {formError}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rm-title">Título</Label>
            <Input
              id="rm-title"
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              required
              value={form.title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rm-description">Descrição</Label>
            <Textarea
              id="rm-description"
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              value={form.description}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rm-start">Início</Label>
              <Input
                id="rm-start"
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                required
                type="date"
                value={form.startDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-end">Fim</Label>
              <Input
                id="rm-end"
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                required
                type="date"
                value={form.endDate}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rm-status">Status</Label>
              <Select
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    status: value as CreateFormState["status"],
                  }))
                }
                value={form.status}
              >
                <SelectTrigger id="rm-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATE_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CREATE_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-color">Cor</Label>
              <Input
                className="h-9 w-full p-1"
                id="rm-color"
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
                type="color"
                value={form.color}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rm-art">ART</Label>
              <Select
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    artId: value === "none" ? "" : value,
                  }))
                }
                value={form.artId || "none"}
              >
                <SelectTrigger id="rm-art">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem ART</SelectItem>
                  {arts.map((art) => (
                    <SelectItem key={art.id} value={art.id}>
                      {art.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-epic">Épico</Label>
              <Select
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    epicId: value === "none" ? "" : value,
                  }))
                }
                value={form.epicId || "none"}
              >
                <SelectTrigger id="rm-epic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem épico</SelectItem>
                  {epics.map((epic) => (
                    <SelectItem key={epic.id} value={epic.id}>
                      {epic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.milestone}
              id="rm-milestone"
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, milestone: checked === true }))
              }
            />
            <Label htmlFor="rm-milestone">Marcar como marco (milestone)</Label>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
