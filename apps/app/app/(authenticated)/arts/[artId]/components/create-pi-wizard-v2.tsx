"use client";

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
  CalendarPlusIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createPIPlanWithDetails } from "../../../../actions/arts/pi-plans";
import type { PIObjectiveInput } from "../../../../actions/arts/schema";
import { PIDatePicker } from "./pi-date-picker";

export type CreatePIWizardV2Props = {
  artId: string;
  artName: string;
  cadence: number;
  teams: Array<{ id: string; name: string; velocity: number | null }>;
};

const DURATION_OPTIONS = [
  { weeks: 8, label: "8 sem" },
  { weeks: 10, label: "10 sem" },
  { weeks: 12, label: "12 sem" },
] as const;

const STEP_COUNT = 5;
const STEP_TITLES = [
  "Identificação",
  "Equipes Participantes",
  "Objetivos do PI",
  "Roadmap & Dependências",
  "Revisão & Confiança",
];

function getQuarter(date: Date): string {
  return `Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function computeEndDate(start: Date, weeks: number): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7);
  return end;
}

function sprintBreakdown(weeks: number): string {
  const regular = Math.floor(weeks / 2) - 1;
  return `${regular} sem + 1 IP`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const inputStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--hairline)",
  color: "var(--ink)",
};

type DraftObjective = PIObjectiveInput & { id: string };

export function CreatePIWizardV2({
  artId,
  artName,
  cadence,
  teams,
}: CreatePIWizardV2Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [duration, setDuration] = useState<number>(cadence || 10);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() =>
    teams.map((t) => t.id)
  );

  const [objectives, setObjectives] = useState<DraftObjective[]>([]);
  const [objTitle, setObjTitle] = useState("");
  const [objDescription, setObjDescription] = useState("");
  const [objTeamId, setObjTeamId] = useState<string>("none");
  const [objIsStretch, setObjIsStretch] = useState(false);
  const [objBusinessValue, setObjBusinessValue] = useState(5);

  const [includeConfidenceVote, setIncludeConfidenceVote] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(3.0);

  const endDate = useMemo(
    () => (startDate ? computeEndDate(startDate, duration) : undefined),
    [startDate, duration]
  );

  const previewName = useMemo(() => {
    if (!startDate) {
      return "PI-----–-Q-";
    }
    return `PI-${startDate.getFullYear()}-${getQuarter(startDate)}`;
  }, [startDate]);

  const committedCount = objectives.filter((o) => !o.isStretch).length;
  const stretchCount = objectives.filter((o) => o.isStretch).length;

  const committedByTeam = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of objectives) {
      if (!o.isStretch && o.teamId) {
        map.set(o.teamId, (map.get(o.teamId) ?? 0) + 1);
      }
    }
    return map;
  }, [objectives]);

  const teamOverCommitted = Array.from(committedByTeam.values()).some(
    (n) => n > 5
  );

  function resetForm() {
    setStep(1);
    setStartDate(undefined);
    setDuration(cadence || 10);
    setSelectedTeamIds(teams.map((t) => t.id));
    setObjectives([]);
    setObjTitle("");
    setObjDescription("");
    setObjTeamId("none");
    setObjIsStretch(false);
    setObjBusinessValue(5);
    setIncludeConfidenceVote(true);
    setConfidenceThreshold(3.0);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  }

  function addObjective() {
    if (!objTitle.trim()) {
      return;
    }
    setObjectives((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: objTitle.trim(),
        description: objDescription.trim() || undefined,
        teamId: objTeamId === "none" ? undefined : objTeamId,
        businessValue: objBusinessValue,
        isStretch: objIsStretch,
      },
    ]);
    setObjTitle("");
    setObjDescription("");
    setObjTeamId("none");
    setObjIsStretch(false);
    setObjBusinessValue(5);
  }

  function removeObjective(id: string) {
    setObjectives((prev) => prev.filter((o) => o.id !== id));
  }

  const canGoNext = step !== 1 || Boolean(startDate);

  function handleNext() {
    if (!canGoNext) {
      return;
    }
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit() {
    startTransition(async () => {
      await createPIPlanWithDetails({
        artId,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        featureIds: [],
        objectives: objectives.map(
          ({ id: _id, ...rest }): PIObjectiveInput => rest
        ),
        risks: [],
        includeConfidenceVote,
        confidenceThreshold,
      });
      handleClose();
      router.refresh();
    });
  }

  const teamName = (id?: string) =>
    id ? (teams.find((t) => t.id === id)?.name ?? "—") : undefined;

  return (
    <Dialog onOpenChange={(v) => (v ? setOpen(true) : handleClose())} open={open}>
      <Button
        onClick={() => setOpen(true)}
        style={{ background: "var(--accent-c)", color: "var(--on-accent)" }}
      >
        <CalendarPlusIcon className="mr-1.5 h-4 w-4" />
        PI Planning
      </Button>
      <DialogContent
        className="gap-0 overflow-hidden p-0"
        style={{ background: "var(--surface)", maxWidth: 900 }}
      >
        <DialogTitle className="sr-only">Criar PI Planning</DialogTitle>

        {/* Header */}
        <div
          style={{
            alignItems: "center",
            borderBottom: "1px solid var(--hairline)",
            display: "flex",
            gap: 12,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "rgba(var(--accent-c-rgb,94,106,210),.12)",
              border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.3)",
              borderRadius: 10,
              display: "flex",
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
          >
            <CalendarPlusIcon
              style={{ color: "var(--accent-c)", height: 18, width: 18 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--ink)", fontSize: 16, fontWeight: 700 }}>
              Criar PI Planning
            </div>
            <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>
              Etapa {step} de {STEP_COUNT} · {STEP_TITLES[step - 1]}
            </div>
          </div>
          <button
            aria-label="Fechar"
            onClick={handleClose}
            style={{
              alignItems: "center",
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              display: "flex",
              height: 34,
              justifyContent: "center",
              width: 34,
            }}
            type="button"
          >
            <XIcon style={{ color: "var(--ink-muted)", height: 16, width: 16 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex" }}>
          {/* Left: live preview */}
          <div
            style={{
              background: "var(--surface-2)",
              borderRight: "1px solid var(--hairline)",
              padding: "20px 18px",
              width: "38%",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 6,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  background: "var(--green)",
                  borderRadius: 999,
                  boxShadow: "0 0 6px var(--green)",
                  height: 7,
                  width: 7,
                }}
              />
              <span
                style={{
                  color: "var(--ink-faint)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Preview ao vivo
              </span>
            </div>

            <div
              style={{
                background: "var(--surface-3, var(--surface))",
                border: "1px solid var(--hairline)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{ color: "var(--ink)", fontSize: 13, fontWeight: 600 }}
                >
                  {previewName}
                </span>
                <span
                  style={{
                    background: "var(--hairline)",
                    borderRadius: 999,
                    color: "var(--ink-muted)",
                    fontSize: 10,
                    padding: "2px 8px",
                  }}
                >
                  Planning
                </span>
              </div>

              <div style={{ color: "var(--ink)", fontSize: 14, marginBottom: 12 }}>
                PI Planning · {artName}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "1fr 1fr",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 6,
                    padding: "6px 10px",
                  }}
                >
                  <div
                    style={{
                      color: "var(--ink-faint)",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Duração
                  </div>
                  <div
                    style={{ color: "var(--ink)", fontSize: 16, fontWeight: 700 }}
                  >
                    {duration} sem
                  </div>
                </div>
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 6,
                    padding: "6px 10px",
                  }}
                >
                  <div
                    style={{
                      color: "var(--ink-faint)",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Confiança
                  </div>
                  <div
                    style={{ color: "var(--ink)", fontSize: 16, fontWeight: 700 }}
                  >
                    {step >= 5 ? confidenceThreshold.toFixed(1) : "—"}
                  </div>
                </div>
              </div>

              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}
              >
                <span
                  style={{
                    background: "rgba(var(--accent-c-rgb,94,106,210),.1)",
                    border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)",
                    borderRadius: 999,
                    color: "var(--ink)",
                    fontSize: 11,
                    padding: "2px 8px",
                  }}
                >
                  {artName}
                </span>
                <span
                  style={{
                    background: "rgba(var(--accent-c-rgb,94,106,210),.1)",
                    border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)",
                    borderRadius: 999,
                    color: "var(--ink)",
                    fontSize: 11,
                    padding: "2px 8px",
                  }}
                >
                  {selectedTeamIds.length} times
                </span>
                {startDate && (
                  <span
                    style={{
                      background: "rgba(var(--accent-c-rgb,94,106,210),.1)",
                      border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)",
                      borderRadius: 999,
                      color: "var(--ink)",
                      fontSize: 11,
                      padding: "2px 8px",
                    }}
                  >
                    início {formatDate(startDate)}
                  </span>
                )}
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  paddingTop: 10,
                }}
              >
                <div
                  style={{ color: "var(--ink)", fontSize: 13, marginBottom: 4 }}
                >
                  Objetivos do PI
                </div>
                <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                  ◼ {committedCount} Comprometidos · ★ {stretchCount} Ambiciosos
                </div>
              </div>
            </div>

            <div
              style={{ color: "var(--ink-faint)", fontSize: 11, marginTop: 14 }}
            >
              Preview fixo — reflete os campos em tempo real. O formulário à
              direita muda conforme a etapa.
            </div>
          </div>

          {/* Right: form */}
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: 18,
              maxHeight: 520,
              overflowY: "auto",
              padding: "20px 24px",
            }}
          >
            {step === 1 && (
              <>
                <div>
                  <Label style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    Nome do PI
                  </Label>
                  <Input
                    disabled
                    style={{ ...inputStyle, marginTop: 8 }}
                    value={previewName}
                  />
                </div>
                <div>
                  <Label style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    ART responsável
                  </Label>
                  <Input
                    disabled
                    style={{ ...inputStyle, marginTop: 8 }}
                    value={artName}
                  />
                </div>
                <div>
                  <Label style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    Data de início *
                  </Label>
                  <div style={{ marginTop: 8 }}>
                    <PIDatePicker
                      date={startDate}
                      label="Selecionar data"
                      onDateChange={setStartDate}
                    />
                  </div>
                </div>
                <div>
                  <Label style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    Duração do PI
                  </Label>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.weeks}
                        onClick={() => setDuration(opt.weeks)}
                        style={{
                          background:
                            duration === opt.weeks
                              ? "var(--accent-c)"
                              : "var(--surface-2)",
                          border: "1px solid var(--hairline)",
                          borderRadius: 8,
                          color: duration === opt.weeks ? "var(--on-accent)" : "var(--ink-muted)",
                          flex: 1,
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "10px 0",
                          transition: "background 150ms ease",
                        }}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{ color: "var(--ink-faint)", fontSize: 12, marginTop: 8 }}
                  >
                    {sprintBreakdown(duration)}
                    {endDate && ` · Término previsto: ${formatDate(endDate)}`}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div
                  style={{ color: "var(--ink-muted)", fontSize: 13, fontWeight: 500 }}
                >
                  {selectedTeamIds.length} equipes selecionadas de {teams.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      style={{
                        alignItems: "center",
                        background: "var(--surface-2)",
                        border: "1px solid var(--hairline)",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        gap: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <Checkbox
                        checked={selectedTeamIds.includes(team.id)}
                        onCheckedChange={() => toggleTeam(team.id)}
                      />
                      <span style={{ color: "var(--ink)", fontSize: 13 }}>
                        {team.name}
                      </span>
                      {team.velocity != null && (
                        <span
                          style={{
                            color: "var(--ink-faint)",
                            fontSize: 12,
                            marginLeft: "auto",
                          }}
                        >
                          {team.velocity} pts/sprint
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                  Você pode criar o PI sem equipes selecionadas, mas não poderá
                  iniciá-lo (mudar status para EXECUTING) sem ao menos 1 equipe.
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: 14,
                  }}
                >
                  <Input
                    onChange={(e) => setObjTitle(e.target.value)}
                    placeholder="Título *"
                    style={inputStyle}
                    value={objTitle}
                  />
                  <Textarea
                    onChange={(e) => setObjDescription(e.target.value)}
                    placeholder="Descrição (opcional)"
                    style={inputStyle}
                    value={objDescription}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Select onValueChange={setObjTeamId} value={objTeamId}>
                      <SelectTrigger style={{ ...inputStyle, flex: 1 }}>
                        <SelectValue placeholder="Time (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (nível ART)</SelectItem>
                        {teams
                          .filter((t) => selectedTeamIds.includes(t.id))
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setObjIsStretch(false)}
                      style={{
                        background: !objIsStretch
                          ? "var(--accent-c)"
                          : "var(--surface)",
                        border: "1px solid var(--hairline)",
                        borderRadius: 8,
                        color: !objIsStretch ? "var(--on-accent)" : "var(--ink-muted)",
                        flex: 1,
                        fontSize: 13,
                        padding: "8px 0",
                      }}
                      type="button"
                    >
                      ◼ Comprometido
                    </button>
                    <button
                      onClick={() => setObjIsStretch(true)}
                      style={{
                        background: objIsStretch
                          ? "var(--accent-c)"
                          : "var(--surface)",
                        border: "1px solid var(--hairline)",
                        borderRadius: 8,
                        color: objIsStretch ? "var(--on-accent)" : "var(--ink-muted)",
                        flex: 1,
                        fontSize: 13,
                        padding: "8px 0",
                      }}
                      type="button"
                    >
                      ★ Ambicioso
                    </button>
                  </div>
                  <div>
                    <Label style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                      Valor de Negócio: {objBusinessValue}
                    </Label>
                    <input
                      max={10}
                      min={1}
                      onChange={(e) => setObjBusinessValue(Number(e.target.value))}
                      style={{ marginTop: 6, width: "100%" }}
                      type="range"
                      value={objBusinessValue}
                    />
                  </div>
                  <Button
                    onClick={addObjective}
                    style={{ background: "var(--accent-c)", color: "var(--on-accent)" }}
                  >
                    <PlusIcon className="mr-1.5 h-4 w-4" />
                    Adicionar Objetivo
                  </Button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {objectives.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        alignItems: "center",
                        background: "var(--surface-2)",
                        border: "1px solid var(--hairline)",
                        borderRadius: 8,
                        display: "flex",
                        gap: 8,
                        padding: "8px 12px",
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        {o.isStretch ? "★" : "◼"}
                      </span>
                      <span
                        style={{ color: "var(--ink)", flex: 1, fontSize: 13 }}
                      >
                        {o.title}
                      </span>
                      {teamName(o.teamId) && (
                        <span
                          style={{ color: "var(--ink-faint)", fontSize: 11 }}
                        >
                          {teamName(o.teamId)}
                        </span>
                      )}
                      <span
                        style={{
                          background: "var(--hairline)",
                          borderRadius: 999,
                          color: "var(--ink-muted)",
                          fontSize: 11,
                          padding: "1px 6px",
                        }}
                      >
                        BV {o.businessValue}
                      </span>
                      <button
                        onClick={() => removeObjective(o.id)}
                        style={{ color: "var(--ink-faint)" }}
                        type="button"
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                  ◼ {committedCount} Comprometidos · ★ {stretchCount} Ambiciosos
                </div>
                {teamOverCommitted && (
                  <div style={{ color: "var(--amber)", fontSize: 12 }}>
                    Máximo recomendado: 5 objetivos comprometidos por time
                  </div>
                )}
              </>
            )}

            {step === 4 && (
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 10,
                  color: "var(--ink-muted)",
                  fontSize: 13,
                  padding: 16,
                }}
              >
                As features do backlog serão vinculadas a este PI durante o
                Program Board, com base em WSJF e capacidade das equipes
                selecionadas.
              </div>
            )}

            {step === 5 && (
              <>
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 10,
                    display: "flex",
                    flexDirection: "column",
                    fontSize: 13,
                    gap: 6,
                    padding: 14,
                  }}
                >
                  <div>
                    <strong style={{ color: "var(--ink)" }}>{previewName}</strong>
                  </div>
                  <div style={{ color: "var(--ink-muted)" }}>
                    {startDate && formatDate(startDate)}
                    {endDate && ` → ${formatDate(endDate)}`} · {duration} sem
                  </div>
                  <div style={{ color: "var(--ink-muted)" }}>
                    {selectedTeamIds.length} equipes · {committedCount}{" "}
                    comprometidos · {stretchCount} ambiciosos
                  </div>
                </div>

                <label
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <Checkbox
                    checked={includeConfidenceVote}
                    onCheckedChange={(v) => setIncludeConfidenceVote(Boolean(v))}
                  />
                  <span style={{ color: "var(--ink)", fontSize: 13 }}>
                    Incluir sessão de votação de confiança neste PI
                  </span>
                </label>

                {includeConfidenceVote && (
                  <div>
                    <Label style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                      Limite de confiança
                    </Label>
                    <Input
                      max={5}
                      min={1}
                      onChange={(e) =>
                        setConfidenceThreshold(Number(e.target.value))
                      }
                      step={0.5}
                      style={{ ...inputStyle, marginTop: 8 }}
                      type="number"
                      value={confidenceThreshold}
                    />
                    <div
                      style={{ color: "var(--ink-faint)", fontSize: 12, marginTop: 6 }}
                    >
                      Fist of Five — PIs com confiança abaixo deste valor são
                      bloqueados para commit sem override do RTE.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            alignItems: "center",
            borderTop: "1px solid var(--hairline)",
            display: "flex",
            justifyContent: "space-between",
            padding: "14px 20px",
          }}
        >
          <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>
            <kbd
              style={{
                background: "var(--surface-2)",
                borderRadius: 4,
                fontSize: 10,
                padding: "1px 5px",
              }}
            >
              esc
            </kbd>{" "}
            cancelar
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1 && (
              <button
                onClick={handleBack}
                style={{
                  background: "transparent",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  color: "var(--ink-muted)",
                  fontSize: 13,
                  padding: "7px 16px",
                }}
                type="button"
              >
                Voltar
              </button>
            )}
            <button
              onClick={handleClose}
              style={{
                background: "transparent",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                color: "var(--ink-muted)",
                fontSize: 13,
                padding: "7px 16px",
              }}
              type="button"
            >
              Cancelar
            </button>
            {step < STEP_COUNT ? (
              <button
                disabled={!canGoNext}
                onClick={handleNext}
                style={{
                  background: "var(--accent-c)",
                  border: "none",
                  borderRadius: 8,
                  color: "var(--on-accent)",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: canGoNext ? 1 : 0.6,
                  padding: "7px 18px",
                }}
                type="button"
              >
                Próximo
              </button>
            ) : (
              <button
                disabled={isPending}
                onClick={handleSubmit}
                style={{
                  background: "var(--accent-c)",
                  border: "none",
                  borderRadius: 8,
                  color: "var(--on-accent)",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: isPending ? 0.6 : 1,
                  padding: "7px 18px",
                }}
                type="button"
              >
                <PlusIcon className="mr-1 inline h-3.5 w-3.5" />
                Criar PI Planning
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
