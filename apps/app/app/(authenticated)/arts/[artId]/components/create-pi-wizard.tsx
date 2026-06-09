"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  AlertTriangleIcon,
  BarChart3Icon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDotIcon,
  HandIcon,
  LayersIcon,
  PlusIcon,
  ShieldCheckIcon,
  TargetIcon,
  Trash2Icon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPIPlanWithDetails,
  type PIObjectiveInput,
  type PIRiskInput,
} from "../../../../actions/arts/pi-plans";
import {
  formatDraftAge,
  useDraftState,
} from "../../../../hooks/use-draft-state";
import {
  WizardBody,
  WizardChromeHeader,
  WizardFooterNav,
  WizardStepHeader,
  wizardDialogContentClassName,
  wizardInputClassName,
} from "../../../components/wizard-ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type Team = { id: string; name: string; velocity: number | null };
type FeatureOption = {
  id: string;
  title: string;
  storyPoints: number;
  wsjfScore: number;
  epic: { id: string; title: string } | null;
};

type Props = {
  artId: string;
  artName: string;
  cadence: number;
  nextPINumber: number;
  teams: Team[];
  features: FeatureOption[];
};

export type CreatePIWizardProps = Props;

type RoamStatus =
  | "IDENTIFIED"
  | "RESOLVED"
  | "OWNED"
  | "ACCEPTED"
  | "MITIGATED";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_COUNT = 6;

const STEP_LABELS: Record<number, string> = {
  1: "Identificação",
  2: "Equipes",
  3: "Features",
  4: "Objetivos PI",
  5: "Riscos ROAM",
  6: "Revisão",
};

const ROAM_OPTIONS: {
  value: RoamStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: "IDENTIFIED",
    label: "Identificado",
    icon: <AlertTriangleIcon className="h-3 w-3" />,
    color: "text-gray-500",
  },
  {
    value: "OWNED",
    label: "Atribuído",
    icon: <HandIcon className="h-3 w-3" />,
    color: "text-blue-500",
  },
  {
    value: "ACCEPTED",
    label: "Aceito",
    icon: <CircleDotIcon className="h-3 w-3" />,
    color: "text-yellow-500",
  },
  {
    value: "MITIGATED",
    label: "Mitigado",
    icon: <ShieldCheckIcon className="h-3 w-3" />,
    color: "text-purple-500",
  },
  {
    value: "RESOLVED",
    label: "Resolvido",
    icon: <CheckCircle2Icon className="h-3 w-3" />,
    color: "text-green-500",
  },
];

const IMPACT_OPTIONS = [
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Médio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "Crítico" },
];
const PROBABILITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];
const CATEGORY_OPTIONS = [
  { value: "technical", label: "Técnico" },
  { value: "business", label: "Negócio" },
  { value: "organizational", label: "Organizacional" },
  { value: "external", label: "Externo" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
      {children}
    </p>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({
  name,
  setName,
  startDate,
  endDate,
  cadence,
  onStartChange,
  onEndChange,
}: {
  name: string;
  setName: (v: string) => void;
  startDate: string;
  endDate: string;
  cadence: number;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const durationDays =
    startDate && endDate
      ? Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            86_400_000
        )
      : null;
  const sprints = durationDays ? Math.floor(durationDays / 14) : null;

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={`Nomeie o Program Increment e defina o período. A cadência do ART é ${cadence} semanas.`}
        icon={<CalendarIcon className="h-5 w-5" />}
        title="Identificação do PI"
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="pi-name">
          Nome do PI <span className="text-destructive">*</span>
        </Label>
        <Input
          autoFocus
          className={wizardInputClassName}
          id="pi-name"
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: PI 1, PI 2025-Q3..."
          value={name}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Início</Label>
          <Input
            className={wizardInputClassName}
            onChange={(e) => onStartChange(e.target.value)}
            type="date"
            value={startDate}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Término</Label>
          <Input
            className={wizardInputClassName}
            min={startDate}
            onChange={(e) => onEndChange(e.target.value)}
            type="date"
            value={endDate}
          />
        </div>
      </div>
      {durationDays !== null && (
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border/70 bg-muted/20">
          {[
            { val: durationDays, label: "dias" },
            { val: Math.round(durationDays / 7), label: "semanas" },
            { val: sprints, label: "sprints" },
            { val: 1, label: "iteração PI" },
          ].map(({ val, label }, idx) => (
            <div
              className={[
                "flex flex-col items-center justify-center gap-1 px-3 py-4 text-center",
                idx % 2 === 0 ? "border-border/60 border-r" : "",
                idx < 2 ? "border-border/60 border-b" : "",
              ].join(" ")}
              key={label}
            >
              <BarChart3Icon
                aria-hidden
                className="h-3.5 w-3.5 text-muted-foreground/70"
              />
              <p className="font-semibold text-xl tabular-nums">{val}</p>
              <p className="text-muted-foreground text-xs">{label}</p>
            </div>
          ))}
        </div>
      )}
      {!startDate && (
        <p className="text-center text-muted-foreground text-xs">
          Datas podem ser definidas depois.
        </p>
      )}
    </div>
  );
}

function Step2({
  teams,
  selected,
  toggle,
}: {
  teams: Team[];
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Selecione os times do ART que participam deste PI. Por padrão todos são incluídos."
        icon={<UsersIcon className="h-5 w-5" />}
        title="Equipes Participantes"
      />
      {teams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          Nenhum time cadastrado neste ART. Crie times em{" "}
          <strong>Settings → Equipes</strong>.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <SectionLabel>
            {selected.size} de {teams.length} time(s) selecionado(s)
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            {teams.map((team) => (
              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
                key={team.id}
              >
                <Checkbox
                  checked={selected.has(team.id)}
                  onCheckedChange={() => toggle(team.id)}
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">{team.name}</p>
                  {team.velocity && (
                    <p className="text-muted-foreground text-xs">
                      {team.velocity} SP/sprint
                    </p>
                  )}
                </div>
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step3({
  features,
  selected,
  toggle,
}: {
  features: FeatureOption[];
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  const byEpic = features.reduce<
    Record<string, { epic: string; items: FeatureOption[] }>
  >((acc, f) => {
    const key = f.epic?.id ?? "__none";
    if (!acc[key]) {
      acc[key] = { epic: f.epic?.title ?? "Sem épico", items: [] };
    }
    acc[key].items.push(f);
    return acc;
  }, {});

  const totalSP = features
    .filter((f) => selected.has(f.id))
    .reduce((s, f) => s + f.storyPoints, 0);

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Selecione features comprometidas para este PI. Apenas features sem PI associado são listadas."
        icon={<LayersIcon className="h-5 w-5" />}
        title="Backlog do PI"
      />
      {features.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          Nenhuma feature disponível no backlog.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byEpic).map(([key, group]) => (
            <div key={key}>
              <SectionLabel>{group.epic}</SectionLabel>
              <div className="mt-2 flex flex-col gap-1.5">
                {group.items.map((f) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40"
                    key={f.id}
                  >
                    <Checkbox
                      checked={selected.has(f.id)}
                      onCheckedChange={() => toggle(f.id)}
                    />
                    <span className="flex-1 truncate text-sm">{f.title}</span>
                    <div className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
                      <span>{f.storyPoints} SP</span>
                      {f.wsjfScore > 0 && (
                        <span className="font-mono font-semibold text-muted-foreground">
                          {f.wsjfScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {selected.size > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-4 py-2 text-sm">
              <span>{selected.size} feature(s) selecionada(s)</span>
              <span className="font-semibold">{totalSP} SP total</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step4({
  objectives,
  setObjectives,
  selectedTeams,
}: {
  objectives: PIObjectiveInput[];
  setObjectives: React.Dispatch<React.SetStateAction<PIObjectiveInput[]>>;
  selectedTeams: Team[];
}) {
  const [form, setForm] = useState({
    teamId: "",
    title: "",
    description: "",
    businessValue: 8,
    isStretch: false,
  });

  function add() {
    if (!form.title.trim()) {
      return;
    }
    setObjectives((prev) => [
      ...prev,
      {
        ...form,
        teamId: form.teamId || undefined,
        description: form.description || undefined,
      },
    ]);
    setForm({
      teamId: "",
      title: "",
      description: "",
      businessValue: 8,
      isStretch: false,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Defina objetivos comprometidos e stretch por time. Business Value de 1 a 10."
        icon={<TargetIcon className="h-5 w-5" />}
        title="Objetivos PI"
      />
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/10 p-4">
        <SectionLabel>Adicionar objetivo</SectionLabel>
        <Input
          className={wizardInputClassName}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Título do objetivo *"
          value={form.title}
        />
        <Textarea
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrição (opcional)"
          rows={2}
          value={form.description}
        />
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Time</Label>
            <Select
              onValueChange={(v) =>
                setForm({ ...form, teamId: v === "none" ? "" : v })
              }
              value={form.teamId || "none"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {selectedTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Business Value</Label>
            <Input
              className={`h-8 text-xs ${wizardInputClassName}`}
              max={10}
              min={1}
              onChange={(e) =>
                setForm({ ...form, businessValue: Number(e.target.value) })
              }
              type="number"
              value={form.businessValue}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Tipo</Label>
            <Select
              onValueChange={(v) =>
                setForm({ ...form, isStretch: v === "stretch" })
              }
              value={form.isStretch ? "stretch" : "committed"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="committed">Comprometido</SelectItem>
                <SelectItem value="stretch">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Button disabled={!form.title.trim()} onClick={add} size="sm">
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>
      {objectives.length > 0 ? (
        <div className="flex flex-col gap-2">
          {objectives.map((o, i) => (
            <div
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
              key={i}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-sm">{o.title}</p>
                  <Badge
                    className="shrink-0 text-xs"
                    variant={o.isStretch ? "outline" : "default"}
                  >
                    {o.isStretch ? "Stretch" : "Comprometido"}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-muted-foreground text-xs">
                  {o.teamId && (
                    <span>
                      {selectedTeams.find((t) => t.id === o.teamId)?.name}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <ZapIcon className="h-3 w-3" /> BV: {o.businessValue}
                  </span>
                </div>
              </div>
              <Button
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setObjectives((prev) => prev.filter((_, idx) => idx !== i))
                }
                size="icon"
                variant="ghost"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground text-xs">
          Nenhum objetivo — pode adicionar depois.
        </p>
      )}
    </div>
  );
}

function Step5({
  risks,
  setRisks,
}: {
  risks: PIRiskInput[];
  setRisks: React.Dispatch<React.SetStateAction<PIRiskInput[]>>;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "IDENTIFIED" as RoamStatus,
    category: "technical",
    impact: "medium",
    probability: "medium",
  });

  function add() {
    if (!form.title.trim()) {
      return;
    }
    setRisks((prev) => [
      ...prev,
      {
        ...form,
        description: form.description || undefined,
        category: form.category || undefined,
      },
    ]);
    setForm({
      title: "",
      description: "",
      status: "IDENTIFIED",
      category: "technical",
      impact: "medium",
      probability: "medium",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Identifique riscos do PI. Classifique com ROAM: Resolved · Owned · Accepted · Mitigated."
        icon={<AlertTriangleIcon className="h-5 w-5" />}
        title="Riscos ROAM"
      />
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/10 p-4">
        <SectionLabel>Adicionar risco</SectionLabel>
        <Input
          className={wizardInputClassName}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Título do risco *"
          value={form.title}
        />
        <Textarea
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrição (opcional)"
          rows={2}
          value={form.description}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Status ROAM", field: "status", opts: ROAM_OPTIONS },
            { label: "Categoria", field: "category", opts: CATEGORY_OPTIONS },
            { label: "Impacto", field: "impact", opts: IMPACT_OPTIONS },
            {
              label: "Probabilidade",
              field: "probability",
              opts: PROBABILITY_OPTIONS,
            },
          ].map(({ label, field, opts }) => (
            <div className="flex flex-col gap-1" key={field}>
              <Label className="text-xs">{label}</Label>
              <Select
                onValueChange={(v) => setForm({ ...form, [field]: v })}
                value={(form as Record<string, string>)[field]}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opts.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div>
          <Button disabled={!form.title.trim()} onClick={add} size="sm">
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>
      {risks.length > 0 ? (
        <div className="flex flex-col gap-2">
          {risks.map((r, i) => {
            const roam = ROAM_OPTIONS.find((o) => o.value === r.status);
            return (
              <div
                className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
                key={i}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{r.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
                    <span className={`flex items-center gap-1 ${roam?.color}`}>
                      {roam?.icon}
                      {roam?.label}
                    </span>
                    <span>
                      ·{" "}
                      {IMPACT_OPTIONS.find((o) => o.value === r.impact)?.label}
                    </span>
                  </div>
                </div>
                <Button
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setRisks((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  size="icon"
                  variant="ghost"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-muted-foreground text-xs">
          Nenhum risco — pode adicionar depois no Quadro ROAM.
        </p>
      )}
    </div>
  );
}

function Step6Review({
  name,
  startDate,
  endDate,
  selectedTeams,
  selectedFeatures,
  objectives,
  risks,
  isPending,
  error,
  onSubmit,
}: {
  name: string;
  startDate: string;
  endDate: string;
  selectedTeams: Team[];
  selectedFeatures: FeatureOption[];
  objectives: PIObjectiveInput[];
  risks: PIRiskInput[];
  isPending: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const durationDays =
    startDate && endDate
      ? Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            86_400_000
        )
      : null;
  const totalSP = selectedFeatures.reduce((s, f) => s + f.storyPoints, 0);

  return (
    <div className="flex flex-col gap-5">
      <WizardStepHeader
        description="Confira os dados antes de criar o PI Planning."
        icon={<CheckCircle2Icon className="h-5 w-5" />}
        title="Revisão"
      />
      <div className="flex flex-col gap-3">
        {[
          {
            title: "Identificação",
            icon: <CalendarIcon className="h-4 w-4" />,
            rows: [
              { label: "Nome", value: name },
              {
                label: "Período",
                value: durationDays
                  ? `${startDate} → ${endDate} (${durationDays}d)`
                  : "Não definido",
              },
            ],
          },
          {
            title: "Equipes",
            icon: <UsersIcon className="h-4 w-4" />,
            rows: selectedTeams.length
              ? selectedTeams.map((t) => ({
                  label: t.name,
                  value: t.velocity ? `${t.velocity} SP/sprint` : "",
                }))
              : [{ label: "Nenhum time selecionado", value: "" }],
          },
          {
            title: `Features (${selectedFeatures.length})`,
            icon: <LayersIcon className="h-4 w-4" />,
            rows: selectedFeatures.length
              ? [
                  ...selectedFeatures.map((f) => ({
                    label: f.title,
                    value: `${f.storyPoints} SP`,
                  })),
                  { label: "Total", value: `${totalSP} SP`, bold: true },
                ]
              : [{ label: "Nenhuma feature selecionada", value: "" }],
          },
          {
            title: `Objetivos PI (${objectives.length})`,
            icon: <TargetIcon className="h-4 w-4" />,
            rows: objectives.length
              ? objectives.map((o) => ({
                  label: o.title,
                  value: `BV:${o.businessValue} · ${o.isStretch ? "Stretch" : "Comprometido"}`,
                }))
              : [{ label: "Nenhum objetivo", value: "" }],
          },
          {
            title: `Riscos ROAM (${risks.length})`,
            icon: <AlertTriangleIcon className="h-4 w-4" />,
            rows: risks.length
              ? risks.map((r) => ({
                  label: r.title,
                  value:
                    ROAM_OPTIONS.find((o) => o.value === r.status)?.label ??
                    r.status,
                }))
              : [{ label: "Nenhum risco", value: "" }],
          },
        ].map(({ title, icon, rows }) => (
          <div className="overflow-hidden rounded-lg border" key={title}>
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
              {icon}
              <p className="font-medium text-sm">{title}</p>
            </div>
            <div className="flex flex-col gap-1.5 px-4 py-3">
              {rows.map((row, i) => (
                <div
                  className="flex items-center justify-between text-sm"
                  key={i}
                >
                  <span
                    className={
                      (row as { bold?: boolean }).bold
                        ? "font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {row.label}
                  </span>
                  {row.value && (
                    <span
                      className={
                        (row as { bold?: boolean }).bold ? "font-semibold" : ""
                      }
                    >
                      {row.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button className="w-full" disabled={isPending} onClick={onSubmit}>
        {isPending ? "Criando PI..." : "Criar PI Planning"}
      </Button>
    </div>
  );
}

// ─── Draft type ───────────────────────────────────────────────────────────────

type PIWizardDraft = {
  step: number;
  name: string;
  startDate: string;
  endDate: string;
  selectedTeamIds: string[];
  selectedFeatureIds: string[];
  objectives: PIObjectiveInput[];
  risks: PIRiskInput[];
};

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function CreatePIWizard({
  artId,
  artName,
  cadence,
  nextPINumber,
  teams,
  features,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultDraft: PIWizardDraft = {
    step: 1,
    name: `PI ${nextPINumber}`,
    startDate: "",
    endDate: "",
    selectedTeamIds: teams.map((t) => t.id),
    selectedFeatureIds: [],
    objectives: [],
    risks: [],
  };

  const [draft, setDraft, clearDraft, draftMeta] = useDraftState<PIWizardDraft>(
    `draft:pi-wizard:${artId}`,
    defaultDraft
  );

  const step = draft.step;
  const name = draft.name;
  const startDate = draft.startDate;
  const endDate = draft.endDate;
  const selectedTeamIds = new Set(draft.selectedTeamIds);
  const selectedFeatureIds = new Set(draft.selectedFeatureIds);
  const objectives = draft.objectives;
  const risks = draft.risks;

  const selectedTeams = teams.filter((t) => selectedTeamIds.has(t.id));
  const selectedFeatures = features.filter((f) => selectedFeatureIds.has(f.id));

  function setStep(s: number | ((prev: number) => number)) {
    setDraft((prev) => ({
      ...prev,
      step: typeof s === "function" ? s(prev.step) : s,
    }));
  }
  function setName(v: string) {
    setDraft((prev) => ({ ...prev, name: v }));
  }
  function setStartDate(v: string) {
    setDraft((prev) => ({ ...prev, startDate: v }));
  }
  function setEndDate(v: string) {
    setDraft((prev) => ({ ...prev, endDate: v }));
  }
  function setObjectives(
    fn: PIObjectiveInput[] | ((p: PIObjectiveInput[]) => PIObjectiveInput[])
  ) {
    setDraft((prev) => ({
      ...prev,
      objectives: typeof fn === "function" ? fn(prev.objectives) : fn,
    }));
  }
  function setRisks(fn: PIRiskInput[] | ((p: PIRiskInput[]) => PIRiskInput[])) {
    setDraft((prev) => ({
      ...prev,
      risks: typeof fn === "function" ? fn(prev.risks) : fn,
    }));
  }

  function handleStartDateChange(v: string) {
    setStartDate(v);
    if (v && cadence) {
      const end = new Date(v);
      end.setDate(end.getDate() + cadence * 7);
      setDraft((prev) => ({
        ...prev,
        startDate: v,
        endDate: end.toISOString().split("T")[0],
      }));
    }
  }

  function toggleTeam(id: string) {
    setDraft((prev) => {
      const s = new Set(prev.selectedTeamIds);
      s.has(id) ? s.delete(id) : s.add(id);
      return { ...prev, selectedTeamIds: [...s] };
    });
  }

  function toggleFeature(id: string) {
    setDraft((prev) => {
      const s = new Set(prev.selectedFeatureIds);
      s.has(id) ? s.delete(id) : s.add(id);
      return { ...prev, selectedFeatureIds: [...s] };
    });
  }

  function handleNext() {
    if (step === 1 && !name.trim()) {
      return;
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => s - 1);
  }

  function handleClose() {
    setOpen(false);
    // Draft preserved — user can return
  }

  function handleDiscardAndClose() {
    clearDraft();
    setOpen(false);
    // Reset to defaults
    setDraft(() => defaultDraft);
  }

  function handleSubmit() {
    if (!name.trim()) {
      setSubmitError("Nome é obrigatório.");
      return;
    }
    setSubmitError(null);
    startTransition(async () => {
      try {
        await createPIPlanWithDetails({
          artId,
          name: name.trim(),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          featureIds: [...selectedFeatureIds],
          objectives,
          risks,
        });
        clearDraft();
        setOpen(false);
        router.refresh();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Erro ao criar PI.");
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(v) => {
        if (v) {
          setOpen(true);
        } else {
          handleClose();
        }
      }}
      open={open}
    >
      <button
        className="relative inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlusIcon className="mr-1.5 h-4 w-4" />
        Novo PI
        {draftMeta.hasDraft && (
          <span
            aria-label="Rascunho salvo"
            className="-top-1 -right-1 absolute h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500"
            title="Rascunho salvo"
          />
        )}
      </button>

      <DialogContent className={wizardDialogContentClassName}>
        <DialogTitle className="sr-only">
          Novo PI Planning — Etapa {step} de {STEP_COUNT}: {STEP_LABELS[step]}
        </DialogTitle>

        <WizardChromeHeader
          draft={
            draftMeta.hasDraft
              ? {
                  savedAtRelative: formatDraftAge(draftMeta.savedAt),
                  onDiscard: handleDiscardAndClose,
                }
              : null
          }
          step={step}
          stepLabel={STEP_LABELS[step]}
          summaryIcon={<CalendarIcon className="h-4 w-4" />}
          summaryTitle={`Novo PI — ${artName}`}
          total={STEP_COUNT}
        />

        <WizardBody>
          {step === 1 && (
            <Step1
              cadence={cadence}
              endDate={endDate}
              name={name}
              onEndChange={setEndDate}
              onStartChange={handleStartDateChange}
              setName={setName}
              startDate={startDate}
            />
          )}
          {step === 2 && (
            <Step2
              selected={selectedTeamIds}
              teams={teams}
              toggle={toggleTeam}
            />
          )}
          {step === 3 && (
            <Step3
              features={features}
              selected={selectedFeatureIds}
              toggle={toggleFeature}
            />
          )}
          {step === 4 && (
            <Step4
              objectives={objectives}
              selectedTeams={selectedTeams}
              setObjectives={setObjectives}
            />
          )}
          {step === 5 && <Step5 risks={risks} setRisks={setRisks} />}
          {step === 6 && (
            <Step6Review
              endDate={endDate}
              error={submitError}
              isPending={isPending}
              name={name}
              objectives={objectives}
              onSubmit={handleSubmit}
              risks={risks}
              selectedFeatures={selectedFeatures}
              selectedTeams={selectedTeams}
              startDate={startDate}
            />
          )}
        </WizardBody>

        {/* Footer */}
        {step < STEP_COUNT && (
          <WizardFooterNav>
            <Button
              className="text-muted-foreground"
              onClick={step === 1 ? handleClose : handleBack}
              size="sm"
              type="button"
              variant="ghost"
            >
              {step === 1 ? (
                "Cancelar"
              ) : (
                <>
                  <ChevronLeftIcon className="mr-1 h-4 w-4" />
                  Voltar
                </>
              )}
            </Button>
            <Button
              className="shadow-sm"
              disabled={step === 1 && !name.trim()}
              onClick={handleNext}
              size="sm"
              type="button"
            >
              Próximo <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          </WizardFooterNav>
        )}
        {step === STEP_COUNT && (
          <WizardFooterNav>
            <Button
              onClick={handleBack}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeftIcon className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </WizardFooterNav>
        )}
      </DialogContent>
    </Dialog>
  );
}
