"use client";

// decisions.tsx — Decision Log, wired to listDecisions(). Chronological list
// of governance/budget/theme decisions with justification, plus a create
// flow (NewDecisionModal) for registering a new DecisionLogEntry.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  createDecision,
  type DecisionLogExport,
  type DecisionView,
  exportDecisionLog,
  listDecisions,
} from "@/app/(cosmos)/actions/decisions";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const DECISAO_TONE: Record<string, "green" | "red" | "amber" | "blue"> = {
  approved: "green",
  rejected: "red",
  deferred: "amber",
  changed: "blue",
};

const TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: "epic_decision", label: "Decisão de Epic" },
  { value: "budget_decision", label: "Decisão de Orçamento" },
  { value: "theme_decision", label: "Decisão de Tema" },
];

// Only "epic" and "theme" are searchable via EntityLinkField (RF-94's
// allow-listed entity kinds). "guardrail" targetType exists in the schema
// but has no entity-search kind, so it is not offered in the create form.
const TARGET_TYPE_OPTIONS: { value: "epic" | "theme"; label: string }[] = [
  { value: "epic", label: "Epic" },
  { value: "theme", label: "Tema" },
];

const DECISAO_OPTIONS: { value: string; label: string }[] = [
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "deferred", label: "Adiada" },
  { value: "changed", label: "Alterada" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
};

const selectStyle: CSSProperties = inputStyle;

// O artefato que o auditor leva embora. O payload inteiro vem do servidor —
// inclusive o rodapé de metadados —, então o navegador só o serializa: nada é
// montado aqui que não tenha sido registrado no export auditado.
function downloadDecisionLog(payload: DecisionLogExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `decision-log-${payload.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function NewDecisionModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [tipo, setTipo] = useState(TIPO_OPTIONS[0].value);
  const [targetType, setTargetType] = useState<"epic" | "theme">("epic");
  const [target, setTarget] = useState<EntityOption | null>(null);
  const [decisao, setDecisao] = useState(DECISAO_OPTIONS[0].value);
  const [titulo, setTitulo] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const changeTargetType = (value: "epic" | "theme") => {
    setTargetType(value);
    setTarget(null);
  };

  const create = async () => {
    if (!(target && justificativa.trim()) || saving) {
      return;
    }
    setSaving(true);
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createDecision({
          tipo: tipo as "epic_decision" | "budget_decision" | "theme_decision",
          targetType,
          targetId: target.id,
          decisao: decisao as "approved" | "rejected" | "deferred" | "changed",
          justificativa: justificativa.trim(),
          titulo: titulo.trim() || undefined,
          tags,
        }),
      {
        loading: "Registrando decisão...",
        success: "Decisão registrada.",
        error: (err: string) => `Não foi possível registrar a decisão: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onCreated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="plus" size={16} strokeWidth={2.4} />}
      subtitle="Registrar uma nova decisão de portfólio com justificativa"
      title="Nova decisão"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="decision-tipo" style={fieldLabelStyle}>
            Tipo de decisão
          </label>
          <select
            id="decision-tipo"
            onChange={(e) => setTipo(e.target.value)}
            style={selectStyle}
            value={tipo}
          >
            {TIPO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="decision-target-type" style={fieldLabelStyle}>
            Tipo de alvo
          </label>
          <select
            id="decision-target-type"
            onChange={(e) =>
              changeTargetType(e.target.value as "epic" | "theme")
            }
            style={selectStyle}
            value={targetType}
          >
            {TARGET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <EntityLinkField
          kind={targetType}
          label={targetType === "epic" ? "Epic" : "Tema"}
          onChange={setTarget}
          value={target}
        />

        <div>
          <label htmlFor="decision-decisao" style={fieldLabelStyle}>
            Decisão
          </label>
          <select
            id="decision-decisao"
            onChange={(e) => setDecisao(e.target.value)}
            style={selectStyle}
            value={decisao}
          >
            {DECISAO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="decision-titulo" style={fieldLabelStyle}>
            Título (opcional)
          </label>
          <input
            id="decision-titulo"
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título curto da decisão…"
            style={inputStyle}
            value={titulo}
          />
        </div>

        <div>
          <label htmlFor="decision-justificativa" style={fieldLabelStyle}>
            Justificativa
          </label>
          <textarea
            id="decision-justificativa"
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Racional da decisão…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            value={justificativa}
          />
        </div>

        <div>
          <label htmlFor="decision-tags" style={fieldLabelStyle}>
            Tags (separadas por vírgula, opcional)
          </label>
          <input
            id="decision-tags"
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="tech-debt, budget…"
            style={inputStyle}
            value={tagsInput}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Registrar decisão
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function DecisionsBody() {
  const modal = useModal();
  const [decisions, setDecisions] = useState<DecisionView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listDecisions().then((r) => {
      if (r.ok) {
        setDecisions(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportLog = async () => {
    if (exporting) {
      return;
    }
    setExporting(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => exportDecisionLog(), {
      loading: "Gerando export do Decision Log...",
      success: "Export gerado — o download vai começar.",
      error: (err: string) => `Não foi possível exportar o log: ${err}`,
    });
    setExporting(false);
    if (res.ok) {
      downloadDecisionLog(res.data);
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Governança"
        meta={<Badge tone="accent">{decisions.length} decisões</Badge>}
        subtitle="Registro de decisões de portfólio com justificativa."
        title="Decision Log"
      >
        {/* Exportar um log vazio produziria um artefato de auditoria sem
            conteúdo e um registro de export inútil. */}
        {!(error || loading) && decisions.length > 0 && (
          <Button
            icon="download"
            onClick={exportLog}
            size="md"
            variant="secondary"
          >
            Exportar JSON
          </Button>
        )}
        <Button
          icon="plus"
          onClick={() => modal.open(<NewDecisionModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Nova decisão
        </Button>
      </PageHeader>
      {error && <ErrorState message="Não foi possível carregar as decisões." />}
      {!error && loading && (
        <div style={{ color: "var(--ink-subtle)" }}>Carregando…</div>
      )}
      {!(error || loading) && decisions.length === 0 && (
        <div style={{ color: "var(--ink-subtle)" }}>
          Nenhuma decisão registrada.
        </div>
      )}
      {!(error || loading) && decisions.length > 0 && (
        <SectionCard title="Histórico de decisões">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {decisions.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {d.titulo}
                  </span>
                  <Badge tone={DECISAO_TONE[d.decisao] ?? "blue"}>
                    {d.decisao}
                  </Badge>
                </div>
                <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                  {d.justificativa}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--ink-faint)",
                    fontSize: 12,
                  }}
                >
                  <span>{d.tipo}</span>
                  <span>·</span>
                  <span>{fmt(d.dataDecisao)}</span>
                  {d.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "var(--ink-subtle)",
                  }}
                >
                  <Avatar name={d.decisorName ?? undefined} size={18} />
                  <span>{d.decisorName ?? "Autor desconhecido"}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default function DecisionsScreen() {
  return (
    <ModalProvider>
      <DecisionsBody />
    </ModalProvider>
  );
}
