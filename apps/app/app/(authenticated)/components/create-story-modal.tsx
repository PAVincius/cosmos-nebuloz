"use client";

import {
  Dialog,
  DialogContent,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckCircle2Icon, CheckIcon, Settings2Icon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createStory } from "@/app/actions/stories";

// ─── Templates ────────────────────────────────────────────────────────────────

type StoryTemplateKey = "padrao" | "lean" | "integrada" | "spike";

type StoryTemplate = {
  key: StoryTemplateKey;
  name: string;
  description: string;
  fieldSummary: string;
  subtitle: string;
  fields: {
    sprint: boolean;
    assignee: boolean;
    priority: boolean;
    accept: boolean;
    external: boolean;
  };
};

const STORY_TEMPLATES: StoryTemplate[] = [
  {
    key: "padrao",
    name: "Story padrão",
    description: "SP + assignee + prioridade + acceptance",
    fieldSummary: "7 campos · title · feature · sprint · sp · assignee · priority · accept",
    subtitle: "entra no backlog da feature",
    fields: { sprint: true, assignee: true, priority: true, accept: true, external: false },
  },
  {
    key: "lean",
    name: "Story enxuta (Lean)",
    description: "Captura rápida no backlog da feature",
    fieldSummary: "3 campos · title · feature · sp",
    subtitle: "entra no backlog da feature",
    fields: { sprint: false, assignee: false, priority: false, accept: false, external: false },
  },
  {
    key: "integrada",
    name: "Story integrada",
    description: "Vinculada a Jira / Linear / GitHub",
    fieldSummary: "4 campos · title · feature · sp · external",
    subtitle: "entra no backlog da feature",
    fields: { sprint: false, assignee: false, priority: false, accept: false, external: true },
  },
  {
    key: "spike",
    name: "Spike técnico",
    description: "Investigação com timebox — sem priorização",
    fieldSummary: "4 campos · title · feature · sp · accept",
    subtitle: "entra no backlog da feature",
    fields: { sprint: false, assignee: false, priority: false, accept: true, external: false },
  },
];

const FIBONACCI_STORY = [1, 2, 3, 5, 8, 13];
const PRIORITIES = ["Baixa", "Média", "Alta", "Crítica"] as const;
type Priority = (typeof PRIORITIES)[number];

const MOCK_ASSIGNEES = [
  { id: "u1", name: "M. Alves" },
  { id: "u2", name: "A. Lima" },
  { id: "u3", name: "C. Reis" },
];

const PRIORITY_MAP: Record<Priority, string> = {
  Baixa: "low",
  Média: "medium",
  Alta: "high",
  Crítica: "critical",
};

// ─── Props ────────────────────────────────────────────────────────────────────

export type CreateStoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureId?: string;
  featureTitle?: string;
  features: Array<{ id: string; artScopedId: string | null; title: string }>;
  sprints: Array<{ id: string; name: string }>;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateStoryModal({
  open,
  onOpenChange,
  featureId: defaultFeatureId,
  features,
  sprints,
}: CreateStoryModalProps) {
  const [templateKey, setTemplateKey] = useState<StoryTemplateKey>("padrao");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const gearRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState(defaultFeatureId ?? features[0]?.id ?? "");
  const [sprintId, setSprintId] = useState(sprints[0]?.id ?? "");
  const [sp, setSp] = useState(5);
  const [assigneeId, setAssigneeId] = useState(MOCK_ASSIGNEES[0]?.id ?? "");
  const [priority, setPriority] = useState<Priority>("Média");
  const [accept, setAccept] = useState("");
  const [externalSource, setExternalSource] = useState("none");

  const template = STORY_TEMPLATES.find((t) => t.key === templateKey) ?? STORY_TEMPLATES[0];
  const f = template.fields;

  useEffect(() => {
    if (!pickerOpen) return;
    function handle(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        gearRef.current &&
        !gearRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [pickerOpen]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setSelectedFeatureId(defaultFeatureId ?? features[0]?.id ?? "");
      setSprintId(sprints[0]?.id ?? "");
      setSp(5);
      setAssigneeId(MOCK_ASSIGNEES[0]?.id ?? "");
      setPriority("Média");
      setAccept("");
      setExternalSource("none");
    }
  }, [open, features, sprints, defaultFeatureId]);

  function handleSubmit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createStory({
        featureId: selectedFeatureId || undefined,
        sprintId: f.sprint && sprintId ? sprintId : undefined,
        title: title.trim(),
        storyPoints: sp,
        status: "TODO",
        priority: f.priority ? PRIORITY_MAP[priority] : "medium",
        assigneeUserId: f.assignee && assigneeId ? assigneeId : undefined,
        acceptanceCriteria: f.accept && accept ? accept : undefined,
      });
      onOpenChange(false);
    });
  }

  const selectedFeature = features.find((feat) => feat.id === selectedFeatureId);
  const selectedAssignee = MOCK_ASSIGNEES.find((a) => a.id === assigneeId);
  const featureLabel = selectedFeature?.artScopedId ?? "F-PAY-012";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ maxWidth: 860, background: "var(--surface)" }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(52,211,153,.12)",
              border: "1px solid rgba(52,211,153,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CheckCircle2Icon size={18} style={{ color: "var(--green)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
              Criar Story
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
              Template:{" "}
              <span style={{ color: "var(--ink-subtle)" }}>{template.name}</span>
              {" · "}
              {template.subtitle}
            </div>
          </div>

          {/* Gear */}
          <div style={{ position: "relative" }}>
            <button
              ref={gearRef}
              type="button"
              onClick={() => setPickerOpen((p) => !p)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--ink-muted)",
              }}
            >
              <Settings2Icon size={16} />
            </button>
            {pickerOpen && (
              <div
                ref={pickerRef}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 320,
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--hairline)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Settings2Icon size={13} style={{ color: "var(--ink-faint)" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
                      Template do formulário
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
                    Configuração do admin · aplica-se a novas stories
                  </div>
                </div>
                {STORY_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.key}
                    type="button"
                    onClick={() => { setTemplateKey(tmpl.key); setPickerOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      width: "100%",
                      padding: "10px 14px",
                      background: tmpl.key === templateKey ? "rgba(52,211,153,.08)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--hairline)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ width: 16, height: 16, marginTop: 1, flexShrink: 0, color: "var(--green)" }}>
                      {tmpl.key === templateKey && <CheckIcon size={14} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{tmpl.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 1 }}>{tmpl.description}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ink-faint)", marginTop: 3 }}>
                        {tmpl.fieldSummary}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--ink-muted)",
            }}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", minHeight: 0 }}>
          {/* Left: preview */}
          <div
            style={{
              width: "38%",
              flexShrink: 0,
              background: "var(--surface-2)",
              borderRight: "1px solid var(--hairline)",
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--green)",
                  display: "inline-block",
                  boxShadow: "0 0 6px var(--green)",
                }}
              />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--ink-faint)", textTransform: "uppercase" }}>
                Preview ao vivo
              </span>
            </div>

            {/* Story card */}
            <div
              style={{
                background: "var(--surface-3, var(--surface))",
                border: "1px solid var(--hairline)",
                borderRadius: 12,
                padding: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-subtle)", letterSpacing: "0.3px" }}>
                  US-654
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(96,165,250,.1)",
                    color: "var(--blue, #60a5fa)",
                    border: "1px solid rgba(96,165,250,.2)",
                  }}
                >
                  To Do
                </span>
              </div>

              <div style={{ fontSize: 14, color: title ? "var(--ink)" : "var(--ink-faint)", fontStyle: title ? "normal" : "italic", marginBottom: 12, minHeight: 20 }}>
                {title || "Título da story..."}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Story Points</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{sp}</div>
                </div>
                {f.priority && (
                  <div style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "6px 10px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Prioridade</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{priority}</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: f.accept ? 12 : 0 }}>
                {featureLabel && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(var(--accent-c-rgb,94,106,210),.1)", color: "var(--accent-c)", border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)" }}>
                    {featureLabel}
                  </span>
                )}
                {f.assignee && selectedAssignee && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(var(--accent-c-rgb,94,106,210),.1)", color: "var(--accent-c)", border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)" }}>
                    {selectedAssignee.name}
                  </span>
                )}
              </div>

              {f.accept && (
                <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                    Acceptance Criteria
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic" }}>
                    {accept || "Os critérios de aceite aparecerão aqui..."}
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontSize: 11, color: "var(--ink-faint)", lineHeight: 1.5 }}>
              Preview fixo — reflete os campos em tempo real. O formulário à direita muda conforme o template.
            </p>
          </div>

          {/* Right: form */}
          <div
            style={{
              flex: 1,
              padding: "20px 24px",
              overflowY: "auto",
              maxHeight: 520,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* Title */}
            <FormField label="Título da story *">
              <Input
                placeholder="ex: Validar CPF no formulário de cadastro"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
              />
            </FormField>

            {/* Feature */}
            <FormField label="Feature pai">
              <Select value={selectedFeatureId} onValueChange={setSelectedFeatureId}>
                <SelectTrigger style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                  <SelectValue placeholder="Selecionar feature" />
                </SelectTrigger>
                <SelectContent>
                  {features.map((feat) => (
                    <SelectItem key={feat.id} value={feat.id}>
                      {feat.artScopedId ? `${feat.artScopedId} · ` : ""}{feat.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Sprint */}
            {f.sprint && (
              <FormField label="Sprint">
                <Select value={sprintId} onValueChange={setSprintId}>
                  <SelectTrigger style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                    <SelectValue placeholder="Selecionar sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    {sprints.map((s, i) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{i === 0 ? " (atual)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {/* Story Points */}
            <FormField label="Story Points · Fibonacci">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {FIBONACCI_STORY.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSp(n)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      border: "1px solid var(--hairline)",
                      background: sp === n ? "var(--green)" : "var(--surface-2)",
                      color: sp === n ? "var(--on-solid)" : "var(--ink-muted)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background 150ms ease",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Assignee */}
            {f.assignee && (
              <FormField label="Responsável">
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_ASSIGNEES.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {/* Priority */}
            {f.priority && (
              <FormField label="Prioridade">
                <div style={{ display: "flex", gap: 4 }}>
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      style={{
                        flex: 1,
                        padding: "8px 4px",
                        borderRadius: 8,
                        border: "1px solid var(--hairline)",
                        background: priority === p ? "var(--surface-3, #1e2035)" : "var(--surface-2)",
                        color: priority === p ? "var(--ink)" : "var(--ink-muted)",
                        fontSize: 12,
                        fontWeight: priority === p ? 700 : 500,
                        cursor: "pointer",
                        transition: "background 150ms ease",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </FormField>
            )}

            {/* Acceptance Criteria */}
            {f.accept && (
              <FormField label="Acceptance Criteria">
                <Textarea
                  placeholder="Dado [contexto], quando [ação], então [resultado esperado]..."
                  value={accept}
                  onChange={(e) => setAccept(e.target.value)}
                  rows={4}
                  style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)", resize: "vertical" }}
                />
              </FormField>
            )}

            {/* External */}
            {f.external && (
              <FormField label="Fonte externa · sync">
                <Select value={externalSource} onValueChange={setExternalSource}>
                  <SelectTrigger style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nenhuma —</SelectItem>
                    <SelectItem value="jira">Jira</SelectItem>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderTop: "1px solid var(--hairline)",
            background: "var(--surface)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            <kbd style={{ padding: "1px 5px", borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--hairline)", fontSize: 10 }}>esc</kbd>
            {" cancelar · "}
            <kbd style={{ padding: "1px 5px", borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--hairline)", fontSize: 10 }}>↵</kbd>
            {" criar"}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--hairline)",
                color: "var(--ink-muted)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim() || isPending}
              style={{
                padding: "7px 18px",
                borderRadius: 8,
                background: "var(--green)",
                border: "none",
                color: "var(--on-solid)",
                fontSize: 13,
                fontWeight: 600,
                cursor: title.trim() ? "pointer" : "not-allowed",
                opacity: title.trim() && !isPending ? 1 : 0.6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              + Criar story
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink-muted)", marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
