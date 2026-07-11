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
import { CheckIcon, LayoutGridIcon, Settings2Icon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createFeature } from "@/app/actions/features";

// ─── Template definitions ─────────────────────────────────────────────────────

type TemplateKey = "padrao" | "lean" | "integrada" | "ready_pi";

type FeatureTemplate = {
  key: TemplateKey;
  name: string;
  description: string;
  fieldSummary: string;
  fields: {
    art: boolean;
    epic: boolean;
    team: boolean;
    sp: boolean;
    wsjf: boolean;
    accept: boolean;
    external: boolean;
    readiness: boolean;
  };
  subtitle: string;
};

const TEMPLATES: FeatureTemplate[] = [
  {
    key: "padrao",
    name: "Feature padrão",
    description: "WSJF + story points + acceptance criteria",
    fieldSummary: "7 campos · title · art · epic · team · sp · wsjf · accept",
    subtitle: "entra no backlog do épico",
    fields: { art: true, epic: true, team: true, sp: true, wsjf: true, accept: true, external: false, readiness: false },
  },
  {
    key: "lean",
    name: "Feature enxuta (Lean)",
    description: "Captura rápida no backlog do épico",
    fieldSummary: "4 campos · title · art · epic · sp",
    subtitle: "entra no backlog do épico",
    fields: { art: true, epic: true, team: false, sp: true, wsjf: false, accept: false, external: false, readiness: false },
  },
  {
    key: "integrada",
    name: "Feature integrada",
    description: "Vinculada a Jira / Linear / GitHub",
    fieldSummary: "6 campos · title · art · epic · team · sp · external",
    subtitle: "entra no backlog do épico",
    fields: { art: true, epic: true, team: true, sp: true, wsjf: false, accept: false, external: true, readiness: false },
  },
  {
    key: "ready_pi",
    name: "Feature ready-for-PI",
    description: "Inclui readiness gate + acceptance",
    fieldSummary: "8 campos · title · art · epic · team · sp · wsjf · accept · readiness",
    subtitle: "entra no backlog do épico",
    fields: { art: true, epic: true, team: true, sp: true, wsjf: true, accept: true, external: false, readiness: true },
  },
];

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

// ─── Props ────────────────────────────────────────────────────────────────────

export type CreateFeatureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epicId?: string;
  epicTitle?: string;
  arts: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; sequenceNumber: number | null; title: string }>;
  teams: Array<{ id: string; name: string }>;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateFeatureModal({
  open,
  onOpenChange,
  epicId: defaultEpicId,
  epicTitle: _epicTitle,
  arts,
  epics,
  teams,
}: CreateFeatureModalProps) {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("integrada");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const gearRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [artId, setArtId] = useState(arts[0]?.id ?? "");
  const [selectedEpicId, setSelectedEpicId] = useState(defaultEpicId ?? epics[0]?.id ?? "");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [sp, setSp] = useState(5);
  const [bv, setBv] = useState(5);
  const [tc, setTc] = useState(3);
  const [rr, setRr] = useState(2);
  const [js, setJs] = useState(3);
  const [accept, setAccept] = useState("");
  const [externalSource, setExternalSource] = useState("none");

  const template = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[2];
  const f = template.fields;

  // Close picker on outside click
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

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle("");
      setArtId(arts[0]?.id ?? "");
      setSelectedEpicId(defaultEpicId ?? epics[0]?.id ?? "");
      setTeamId(teams[0]?.id ?? "");
      setSp(5);
      setBv(5); setTc(3); setRr(2); setJs(3);
      setAccept("");
      setExternalSource("none");
    }
  }, [open, arts, epics, teams, defaultEpicId]);

  function handleSubmit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createFeature({
        epicId: selectedEpicId,
        title: title.trim(),
        statusId: "BACKLOG",
        storyPoints: sp,
        bv: f.wsjf ? bv : 5,
        tc: f.wsjf ? tc : 3,
        rr: f.wsjf ? rr : 2,
        js: f.wsjf ? js : 3,
      });
      onOpenChange(false);
    });
  }

  const selectedArt = arts.find((a) => a.id === artId);
  const selectedEpic = epics.find((e) => e.id === selectedEpicId);
  const selectedTeam = teams.find((t) => t.id === teamId);
  const epicLabel = selectedEpic
    ? `EP-${String(selectedEpic.sequenceNumber ?? "???").padStart(4, "0")}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ maxWidth: 900, background: "var(--surface)" }}
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
              background: "rgba(var(--accent-c-rgb,94,106,210),.12)",
              border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <LayoutGridIcon size={18} style={{ color: "var(--accent-c)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
              Criar Feature
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
              Template:{" "}
              <span style={{ color: "var(--ink-subtle)" }}>{template.name}</span>
              {" · "}
              {template.subtitle}
            </div>
          </div>
          {/* Gear (template picker) */}
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
                    Configuração do admin · aplica-se a novas features
                  </div>
                </div>
                {TEMPLATES.map((tmpl) => (
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
                      background: tmpl.key === templateKey ? "rgba(var(--accent-c-rgb,94,106,210),.08)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--hairline)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ width: 16, height: 16, marginTop: 1, flexShrink: 0, color: "var(--accent-c)" }}>
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

          {/* Close */}
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
          {/* Left: live preview */}
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
            {/* Badge */}
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

            {/* Feature card */}
            <div
              style={{
                background: "var(--surface-3, var(--surface))",
                border: "1px solid var(--hairline)",
                borderRadius: 12,
                padding: "14px",
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-subtle)", letterSpacing: "0.3px" }}>
                  F-???-051
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--hairline)",
                    color: "var(--ink-muted)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  Backlog
                </span>
              </div>

              {/* Title */}
              <div style={{ fontSize: 14, color: title ? "var(--ink)" : "var(--ink-faint)", fontStyle: title ? "normal" : "italic", marginBottom: 12, minHeight: 20 }}>
                {title || "Título da feature..."}
              </div>

              {/* WSJF + SP */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>WSJF</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-subtle)" }}>—</div>
                </div>
                <div style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Story Points</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{sp}</div>
                </div>
              </div>

              {/* Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: f.accept ? 12 : 0 }}>
                {selectedArt && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(var(--accent-c-rgb,94,106,210),.1)", color: "var(--accent-c)", border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)" }}>
                    {selectedArt.name}
                  </span>
                )}
                {epicLabel && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(var(--accent-c-rgb,94,106,210),.1)", color: "var(--accent-c)", border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)" }}>
                    {epicLabel}
                  </span>
                )}
                {f.team && selectedTeam && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(var(--accent-c-rgb,94,106,210),.1)", color: "var(--accent-c)", border: "1px solid rgba(var(--accent-c-rgb,94,106,210),.2)" }}>
                    {selectedTeam.name}
                  </span>
                )}
              </div>

              {/* Acceptance Criteria */}
              {f.accept && (
                <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                    Acceptance Criteria
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic" }}>
                    {accept || "Template sem acceptance criteria."}
                  </div>
                </div>
              )}
            </div>

            {/* Note */}
            <p style={{ fontSize: 11, color: "var(--ink-faint)", lineHeight: 1.5 }}>
              Preview fixo — reflete os campos em tempo real. O formulário à direita muda conforme o template escolhido na engrenagem.
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
            <FormField label="Título da feature *">
              <Input
                placeholder="ex: Extrair serviço de tokenização"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
              />
            </FormField>

            {/* ART */}
            {f.art && (
              <FormField label="ART responsável">
                <Select value={artId} onValueChange={setArtId}>
                  <SelectTrigger style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                    <SelectValue placeholder="Selecionar ART" />
                  </SelectTrigger>
                  <SelectContent>
                    {arts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {/* Epic */}
            {f.epic && (
              <FormField label="Épico pai">
                <Select value={selectedEpicId} onValueChange={setSelectedEpicId}>
                  <SelectTrigger style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                    <SelectValue placeholder="Selecionar épico" />
                  </SelectTrigger>
                  <SelectContent>
                    {epics.map((ep) => (
                      <SelectItem key={ep.id} value={ep.id}>
                        EP-{String(ep.sequenceNumber ?? "???").padStart(4, "0")} · {ep.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {/* Team */}
            {f.team && (
              <FormField label="Time atribuído">
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                    <SelectValue placeholder="Selecionar time" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {/* Story Points */}
            {f.sp && (
              <FormField label="Story Points · Fibonacci">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FIBONACCI.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSp(n)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        border: "1px solid var(--hairline)",
                        background: sp === n ? "var(--accent-c)" : "var(--surface-2)",
                        color: sp === n ? "var(--on-accent)" : "var(--ink-muted)",
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
                <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>
                  * Job Size {sp} · story points e job size medem o mesmo esforço
                </p>
              </FormField>
            )}

            {/* WSJF */}
            {f.wsjf && (
              <FormField label="WSJF">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {([["BV", bv, setBv], ["TC", tc, setTc], ["RR", rr, setRr], ["JS", js, setJs]] as [string, number, (n: number) => void][]).map(
                    ([label, val, setter]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: "var(--ink-faint)", marginBottom: 4 }}>{label}</div>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={val}
                          onChange={(e) => setter(Number(e.target.value))}
                          style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
                        />
                      </div>
                    )
                  )}
                </div>
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
                <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>
                  Vincula a feature a um item externo (externalId/Url).
                </p>
              </FormField>
            )}

            {/* Acceptance Criteria */}
            {f.accept && (
              <FormField label="Acceptance Criteria">
                <Textarea
                  placeholder="Dado [contexto], quando [ação], então [resultado esperado]..."
                  value={accept}
                  onChange={(e) => setAccept(e.target.value)}
                  rows={3}
                  style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)", resize: "vertical" }}
                />
              </FormField>
            )}

            {/* Readiness */}
            {f.readiness && (
              <FormField label="Readiness Gate">
                {["INVEST criteria met", "Acceptance criteria defined", "Dependencies identified", "Sized by team"].map((item) => (
                  <label key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-muted)", marginBottom: 6, cursor: "pointer" }}>
                    <input type="checkbox" style={{ accentColor: "var(--accent-c)" }} />
                    {item}
                  </label>
                ))}
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
                background: "var(--accent-c)",
                border: "none",
                color: "var(--on-accent)",
                fontSize: 13,
                fontWeight: 600,
                cursor: title.trim() ? "pointer" : "not-allowed",
                opacity: title.trim() && !isPending ? 1 : 0.6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              + Criar feature
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── FormField helper ─────────────────────────────────────────────────────────

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
