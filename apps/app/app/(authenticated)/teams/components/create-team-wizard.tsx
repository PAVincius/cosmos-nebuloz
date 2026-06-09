"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  LayersIcon,
  PlusIcon,
  TimerIcon,
  TrashIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { formatDraftAge, useDraftState } from "../../../hooks/use-draft-state";
import {
  WizardBody,
  WizardChromeHeader,
  WizardFooterNav,
  WizardStepHeader,
  wizardDialogContentClassName,
  wizardInputClassName,
} from "../../components/wizard-ui";
import type { TeamMember } from "../actions";
import { createTeam } from "../actions";
import type { TenantMemberResult } from "./member-search-input";
import { MemberSearchInput } from "./member-search-input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Art = { id: string; name: string; cadence: number };

type SprintPreset = 7 | 14 | 21;

type WizardFormData = {
  name: string;
  artId: string | null;
  members: TeamMember[];
  velocity: number | null;
  sprintLengthDays: SprintPreset | number;
  sprintIsCustom: boolean;
};

const MEMBER_ROLES = [
  "SM",
  "PO",
  "DEV",
  "QA",
  "DevOps",
  "UX",
  "Arquiteto",
  "Analista",
] as const;

type MemberRole = (typeof MEMBER_ROLES)[number];

const PRESET_SKILLS = [
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "Python",
  "Java",
  "Go",
  "PostgreSQL",
  "AWS",
  "Docker",
] as const;

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Team identity
// ---------------------------------------------------------------------------

type Step1Props = {
  formData: WizardFormData;
  arts: Art[];
  onUpdate: (patch: Partial<WizardFormData>) => void;
  nameError: string | null;
};

function Step1Identity({ formData, arts, onUpdate, nameError }: Step1Props) {
  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Dê um nome ao time e vincule ao ART correspondente."
        icon={<UsersIcon className="h-5 w-5" />}
        title="Identidade do Time"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="wizard-team-name">
          Nome do time{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </Label>
        <Input
          aria-describedby={nameError ? "name-error" : undefined}
          aria-invalid={nameError !== null}
          autoFocus
          className={wizardInputClassName}
          id="wizard-team-name"
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="ex: Team Phoenix, Plataforma Core..."
          value={formData.name}
        />
        {nameError && (
          <p className="text-destructive text-sm" id="name-error">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>ART vinculado</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {/* No ART card */}
          <button
            className={[
              "rounded-lg border px-4 py-3 text-left transition-all duration-200",
              formData.artId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/40",
            ].join(" ")}
            onClick={() => onUpdate({ artId: null })}
            type="button"
          >
            <p className="font-medium text-sm">Sem ART</p>
            <p className="mt-0.5 text-xs opacity-70">Time independente</p>
          </button>

          {arts.map((art) => (
            <button
              className={[
                "rounded-lg border px-4 py-3 text-left transition-all duration-200",
                formData.artId === art.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/40",
              ].join(" ")}
              key={art.id}
              onClick={() => onUpdate({ artId: art.id })}
              type="button"
            >
              <p className="font-medium text-sm">{art.name}</p>
              <p className="mt-0.5 text-xs opacity-70">{art.cadence}w por PI</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Members
// ---------------------------------------------------------------------------

type Step2Props = {
  formData: WizardFormData;
  initialMembers: TenantMemberResult[];
  onUpdate: (patch: Partial<WizardFormData>) => void;
  onSkip: () => void;
};

function Step2Members({
  formData,
  initialMembers,
  onUpdate,
  onSkip,
}: Step2Props) {
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("DEV");
  const [memberHours, setMemberHours] = useState<number>(40);
  const [skillInput, setSkillInput] = useState("");
  const [pendingSkills, setPendingSkills] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const skillInputRef = useRef<HTMLInputElement>(null);

  const addSkillFromInput = useCallback(() => {
    const trimmed = skillInput.trim();
    if (trimmed && !pendingSkills.includes(trimmed)) {
      setPendingSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
  }, [skillInput, pendingSkills]);

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkillFromInput();
    } else if (
      e.key === "Backspace" &&
      skillInput === "" &&
      pendingSkills.length > 0
    ) {
      setPendingSkills((prev) => prev.slice(0, -1));
    }
  };

  const togglePresetSkill = (skill: string) => {
    setPendingSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleAddMember = () => {
    if (!memberName.trim()) {
      setAddError("Informe o nome do membro.");
      return;
    }
    setAddError(null);
    const newMember: TeamMember = {
      id: Math.random().toString(36).slice(2, 10),
      name: memberName.trim(),
      role: memberRole,
      skills: pendingSkills,
      hoursPerWeek: memberHours,
    };
    onUpdate({ members: [...formData.members, newMember] });
    setMemberName("");
    setMemberRole("DEV");
    setMemberHours(40);
    setPendingSkills([]);
    setSkillInput("");
  };

  const handleRemoveMember = (id: string) => {
    onUpdate({ members: formData.members.filter((m) => m.id !== id) });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) {
      return name.slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts.at(-1)[0]).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Adicione os integrantes, funções e skills. Pode configurar depois."
        icon={<UsersIcon className="h-5 w-5" />}
        title="Membros do Time"
      />

      {/* Add member form */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/10 p-4">
        <SectionLabel>Adicionar membro</SectionLabel>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Buscar membro</Label>
          <MemberSearchInput
            excludeUserIds={formData.members.map((m) => m.id)}
            initialMembers={initialMembers}
            onMemberSelect={(selected) => {
              const newMember: TeamMember = {
                id: selected.userId,
                name: selected.name,
                role: "DEV",
                skills: [],
                hoursPerWeek: 40,
              };
              onUpdate({ members: [...formData.members, newMember] });
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-muted-foreground text-xs">
            ou preencha manualmente
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs" htmlFor="member-name">
              Nome
            </Label>
            <Input
              className={`h-8 text-sm ${wizardInputClassName}`}
              id="member-name"
              onChange={(e) => setMemberName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
              placeholder="ex: Ana Silva"
              value={memberName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs" htmlFor="member-role">
              Função
            </Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              id="member-role"
              onChange={(e) => setMemberRole(e.target.value as MemberRole)}
              value={memberRole}
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs" htmlFor="member-hours">
            Horas/semana
          </Label>
          <Input
            className={`h-8 w-28 text-sm ${wizardInputClassName}`}
            id="member-hours"
            max={60}
            min={1}
            onChange={(e) => setMemberHours(Number(e.target.value))}
            type="number"
            value={memberHours}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">Skills</Label>

          {/* Preset skill pills */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SKILLS.map((skill) => (
              <button
                className={[
                  "rounded-full border px-2.5 py-0.5 font-medium text-xs transition-all duration-150",
                  pendingSkills.includes(skill)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/40",
                ].join(" ")}
                key={skill}
                onClick={() => togglePresetSkill(skill)}
                type="button"
              >
                {skill}
              </button>
            ))}
          </div>

          {/* Custom skill input */}
          <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5">
            {pendingSkills
              .filter(
                (s) =>
                  !PRESET_SKILLS.includes(s as (typeof PRESET_SKILLS)[number])
              )
              .map((skill) => (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs"
                  key={skill}
                >
                  {skill}
                  <button
                    aria-label={`Remover ${skill}`}
                    className="transition-colors hover:text-destructive"
                    onClick={() =>
                      setPendingSkills((prev) =>
                        prev.filter((s) => s !== skill)
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
            <input
              className="min-w-[80px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              onBlur={addSkillFromInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder={
                pendingSkills.length === 0 ? "Outra skill... (Enter)" : ""
              }
              ref={skillInputRef}
              type="text"
              value={skillInput}
            />
          </div>
        </div>

        {addError && <p className="text-destructive text-xs">{addError}</p>}

        <Button
          className="self-start"
          onClick={handleAddMember}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Adicionar membro
        </Button>
      </div>

      {/* Members list */}
      {formData.members.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>
            {formData.members.length}{" "}
            {formData.members.length === 1 ? "membro" : "membros"} adicionado
            {formData.members.length > 1 ? "s" : ""}
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {formData.members.map((member) => (
              <div
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/10 px-3 py-2.5"
                key={member.id}
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                  {getInitials(member.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{member.name}</span>
                    <Badge className="text-xs" variant="secondary">
                      {member.role}
                    </Badge>
                    <Badge className="text-xs" variant="outline">
                      {member.hoursPerWeek}h/sem
                    </Badge>
                  </div>
                  {member.skills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {member.skills.map((skill) => (
                        <span
                          className="inline-block rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
                          key={skill}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  aria-label={`Remover ${member.name}`}
                  className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive"
                  onClick={() => handleRemoveMember(member.id)}
                  type="button"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {formData.members.length === 0 && (
        <div className="text-center">
          <button
            className="text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
            onClick={onSkip}
            type="button"
          >
            Pular esta etapa
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Capacity & rhythm
// ---------------------------------------------------------------------------

type Step3Props = {
  formData: WizardFormData;
  onUpdate: (patch: Partial<WizardFormData>) => void;
  onSkip: () => void;
};

const SPRINT_PRESETS: {
  days: SprintPreset;
  label: string;
  sublabel: string;
  isDefault?: boolean;
}[] = [
  { days: 7, label: "1 semana", sublabel: "7 dias" },
  {
    days: 14,
    label: "2 semanas",
    sublabel: "14 dias — SAFe padrão",
    isDefault: true,
  },
  { days: 21, label: "3 semanas", sublabel: "21 dias" },
];

function Step3Capacity({ formData, onUpdate, onSkip }: Step3Props) {
  const [customDays, setCustomDays] = useState<string>("");

  const totalHoursPerSprint =
    formData.members.reduce((s, m) => s + m.hoursPerWeek, 0) *
    (formData.sprintLengthDays / 7);

  const throughput =
    formData.velocity && totalHoursPerSprint > 0
      ? (formData.velocity / totalHoursPerSprint).toFixed(2)
      : null;

  const selectPreset = (days: SprintPreset) => {
    setCustomDays("");
    onUpdate({ sprintLengthDays: days, sprintIsCustom: false });
  };

  const handleCustomDays = (val: string) => {
    setCustomDays(val);
    const parsed = Number.parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onUpdate({ sprintLengthDays: parsed, sprintIsCustom: true });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Configure velocidade e duração do sprint. Pode ajustar depois."
        icon={<ZapIcon className="h-5 w-5" />}
        title="Capacidade & Ritmo"
      />

      {/* Velocity */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="velocity">
          <SectionLabel>Story Points por sprint</SectionLabel>
        </Label>
        <Input
          className={`w-40 ${wizardInputClassName}`}
          id="velocity"
          min={1}
          onChange={(e) =>
            onUpdate({
              velocity: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="ex: 40"
          type="number"
          value={formData.velocity ?? ""}
        />
      </div>

      {/* Sprint length */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Duração do sprint</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {SPRINT_PRESETS.map((preset) => {
            const isSelected =
              !formData.sprintIsCustom &&
              formData.sprintLengthDays === preset.days;
            return (
              <button
                className={[
                  "relative rounded-lg border px-3 py-3 text-left transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/40",
                ].join(" ")}
                key={preset.days}
                onClick={() => selectPreset(preset.days)}
                type="button"
              >
                {preset.isDefault && (
                  <span className="-top-2 absolute left-3 rounded-full bg-primary px-2 py-0.5 font-semibold text-[10px] text-primary-foreground">
                    SAFe padrão
                  </span>
                )}
                <p
                  className={[
                    "font-medium text-sm",
                    isSelected ? "text-primary" : "text-foreground",
                  ].join(" ")}
                >
                  {preset.label}
                </p>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {preset.sublabel}
                </p>
              </button>
            );
          })}
        </div>

        {/* Custom input */}
        <div className="flex items-center gap-3">
          <button
            className={[
              "rounded-lg border px-3 py-2 text-xs transition-all duration-200",
              formData.sprintIsCustom
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/40",
            ].join(" ")}
            onClick={() => {
              onUpdate({ sprintIsCustom: true });
              if (customDays) {
                const parsed = Number.parseInt(customDays, 10);
                if (!isNaN(parsed) && parsed > 0) {
                  onUpdate({ sprintLengthDays: parsed });
                }
              }
            }}
            type="button"
          >
            Personalizado
          </button>
          {formData.sprintIsCustom && (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                className={`h-8 w-20 text-sm ${wizardInputClassName}`}
                min={1}
                onChange={(e) => handleCustomDays(e.target.value)}
                placeholder="dias"
                type="number"
                value={customDays}
              />
              <span className="text-muted-foreground text-sm">dias</span>
            </div>
          )}
        </div>
      </div>

      {/* Live metrics */}
      {formData.members.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 p-4">
          <SectionLabel>Métricas calculadas</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono font-semibold text-xl tabular-nums">
                {Math.round(totalHoursPerSprint)}h
              </p>
              <p className="text-muted-foreground text-xs">
                Capacidade total/sprint
              </p>
            </div>
            {throughput && (
              <div>
                <p className="font-mono font-semibold text-xl tabular-nums">
                  {throughput}
                </p>
                <p className="text-muted-foreground text-xs">
                  SP/hora throughput
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-center">
        <button
          className="text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
          onClick={onSkip}
          type="button"
        >
          Configurar depois
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Review
// ---------------------------------------------------------------------------

type Step4Props = {
  formData: WizardFormData;
  arts: Art[];
  isPending: boolean;
  error: string | null;
  onSubmit: () => void;
};

function Step4Review({
  formData,
  arts,
  isPending,
  error,
  onSubmit,
}: Step4Props) {
  const artName =
    formData.artId === null
      ? "Independente"
      : (arts.find((a) => a.id === formData.artId)?.name ?? "—");

  const totalHours = formData.members.reduce((s, m) => s + m.hoursPerWeek, 0);

  const sprintLabel = formData.sprintIsCustom
    ? `${formData.sprintLengthDays} dias (personalizado)`
    : (SPRINT_PRESETS.find((p) => p.days === formData.sprintLengthDays)
        ?.label ?? `${formData.sprintLengthDays} dias`);

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Confira os dados antes de criar o time."
        icon={<ClipboardListIcon className="h-5 w-5" />}
        title="Revisão"
      />

      {/* Summary card */}
      <div className="divide-y divide-border rounded-xl border border-border bg-muted/10">
        <div className="px-5 py-4">
          <SectionLabel>Time</SectionLabel>
          <p className="mt-1.5 font-semibold text-base">{formData.name}</p>
          <p className="text-muted-foreground text-sm">{artName}</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="px-5 py-4">
            <SectionLabel>Membros</SectionLabel>
            <p className="mt-1.5 font-mono font-semibold text-lg tabular-nums">
              {formData.members.length}
            </p>
            {formData.members.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {totalHours}h/semana total
              </p>
            )}
          </div>
          <div className="px-5 py-4">
            <SectionLabel>Velocidade</SectionLabel>
            <p className="mt-1.5 font-mono font-semibold text-lg tabular-nums">
              {formData.velocity ?? "—"}
            </p>
            {formData.velocity && (
              <p className="text-muted-foreground text-xs">SP/sprint</p>
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          <SectionLabel>Sprint</SectionLabel>
          <p className="mt-1.5 flex items-center gap-2 font-medium text-sm">
            <TimerIcon className="h-4 w-4 text-muted-foreground" />
            {sprintLabel}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <Button
        className="w-full"
        disabled={isPending}
        onClick={onSubmit}
        size="lg"
        type="button"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Criando...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4" />
            Criar Time
          </span>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step meta config
// ---------------------------------------------------------------------------

const STEP_COUNT = 4;

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function CreateTeamWizard({
  arts,
  initialMembers,
}: {
  arts: Art[];
  initialMembers: TenantMemberResult[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  type TeamDraft = WizardFormData & { step: number };

  const defaultDraft: TeamDraft = {
    step: 1,
    name: "",
    artId: null,
    members: [],
    velocity: null,
    sprintLengthDays: 14,
    sprintIsCustom: false,
  };

  const [draft, setDraft, clearDraft, draftMeta] = useDraftState<TeamDraft>(
    "draft:team-wizard",
    defaultDraft
  );

  const step = draft.step;
  const formData: WizardFormData = {
    name: draft.name,
    artId: draft.artId,
    members: draft.members,
    velocity: draft.velocity,
    sprintLengthDays: draft.sprintLengthDays,
    sprintIsCustom: draft.sprintIsCustom,
  };

  const updateForm = useCallback(
    (patch: Partial<WizardFormData>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
    },
    [setDraft]
  );

  const resetWizard = () => {
    clearDraft();
    setSubmitError(null);
    setNameError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    // Draft preserved on close — user can return
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraft(() => defaultDraft);
    setOpen(false);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setNameError("O nome do time é obrigatório.");
        return;
      }
      setNameError(null);
    }
    setDraft((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, STEP_COUNT),
    }));
  };

  const handleBack = () =>
    setDraft((prev) => ({ ...prev, step: Math.max(prev.step - 1, 1) }));

  const handleSkipToReview = () => setDraft((prev) => ({ ...prev, step: 4 }));

  const handleSubmit = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        await createTeam({
          name: formData.name.trim(),
          artId: formData.artId,
          velocity: formData.velocity,
          sprintLengthDays: formData.sprintLengthDays,
          members: formData.members,
        });
        setOpen(false);
        setTimeout(resetWizard, 300);
        router.refresh();
      } catch {
        setSubmitError("Erro ao criar o time. Tente novamente.");
      }
    });
  };

  const stepLabels: Record<number, string> = {
    1: "Identidade",
    2: "Membros",
    3: "Capacidade",
    4: "Revisão",
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {/* Trigger */}
      <button
        className="relative inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlusIcon className="mr-1.5 h-4 w-4" />
        Novo Time
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
          Criar Novo Time — Etapa {step} de {STEP_COUNT}: {stepLabels[step]}
        </DialogTitle>

        <WizardChromeHeader
          draft={
            draftMeta.hasDraft
              ? {
                  savedAtRelative: formatDraftAge(draftMeta.savedAt),
                  onDiscard: handleDiscardDraft,
                }
              : null
          }
          step={step}
          stepLabel={stepLabels[step]}
          summaryIcon={<LayersIcon className="h-4 w-4" />}
          summaryTitle="Novo Time"
          total={STEP_COUNT}
        />

        <WizardBody>
          {step === 1 && (
            <Step1Identity
              arts={arts}
              formData={formData}
              nameError={nameError}
              onUpdate={updateForm}
            />
          )}
          {step === 2 && (
            <Step2Members
              formData={formData}
              initialMembers={initialMembers}
              onSkip={handleSkipToReview}
              onUpdate={updateForm}
            />
          )}
          {step === 3 && (
            <Step3Capacity
              formData={formData}
              onSkip={handleSkipToReview}
              onUpdate={updateForm}
            />
          )}
          {step === 4 && (
            <Step4Review
              arts={arts}
              error={submitError}
              formData={formData}
              isPending={isPending}
              onSubmit={handleSubmit}
            />
          )}
        </WizardBody>

        {step < 4 && (
          <WizardFooterNav>
            <Button
              className="text-muted-foreground"
              onClick={step === 1 ? () => setOpen(false) : handleBack}
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
              onClick={handleNext}
              size="sm"
              type="button"
            >
              Próximo
              <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          </WizardFooterNav>
        )}

        {step === 4 && (
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
