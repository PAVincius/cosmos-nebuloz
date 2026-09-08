"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
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
import {
  ModalCard,
  ModalProvider,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import {
  DirtyProvider,
  FormField,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from "../modal-form";
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

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 4,
  textTransform: "uppercase",
};

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
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // A cor do modal é o veredito: quem está registrando uma rejeição vê
  // vermelho antes de terminar de escrever a justificativa.
  const tone = DECISAO_TONE[decisao] ?? "blue";
  const decisaoLabel =
    DECISAO_OPTIONS.find((o) => o.value === decisao)?.label ?? decisao;
  const tipoLabel = TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo;
  // O preview mostra as tags como vão ser gravadas, não o texto cru: a vírgula
  // é o separador, e o que sobra em branco não vira tag.
  const tags = tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const changeTargetType = (value: string) => {
    setTargetType(value as "epic" | "theme");
    // Alvo escolhido no tipo anterior não sobrevive à troca: seria um id de
    // épico gravado como decisão de tema.
    setTarget(null);
  };

  const create = async () => {
    if (!(target && justificativa.trim()) || saving) {
      return;
    }
    setSaving(true);
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

  useModalSubmitShortcut(create, !saving);

  return (
    <DirtyProvider value={{ markDirty: () => setDirty(true) }}>
      <ModalCard
        footer={
          confirmandoSaida ? (
            <>
              <span style={{ color: "var(--ink-subtle)", fontSize: 12.5 }}>
                Descartar o que você preencheu?
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => setConfirmandoSaida(false)}
                  size="sm"
                  variant="secondary"
                >
                  Continuar editando
                </Button>
                <Button onClick={close} size="sm" variant="secondary">
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <>
              <ModalShortcutHint salvar="registrar" />
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => {
                    // Confirma só quando há o que perder.
                    if (dirty) {
                      setConfirmandoSaida(true);
                      return;
                    }
                    close();
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  icon="check"
                  onClick={create}
                  size="sm"
                  variant="primary"
                >
                  {saving ? "Registrando..." : "Registrar decisão"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="book" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Registro auditável de uma decisão de portfólio, com o alvo e a justificativa que a sustentam"
        title="Nova decisão"
        tone={tone}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${tone}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <span
                  className="mono"
                  style={{ color: "var(--ink-faint)", fontSize: 10.5 }}
                >
                  {tipoLabel}
                </span>
                <Badge tone={tone}>{decisaoLabel}</Badge>
              </div>
              <div
                className="display"
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 12,
                }}
              >
                {titulo || "Título da decisão"}
              </div>

              <div style={previewLabelStyle}>
                {targetType === "epic" ? "Epic decidido" : "Tema decidido"}
              </div>
              <div
                style={{
                  color: target ? "var(--ink)" : "var(--ink-faint)",
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                {target?.label ?? "Nenhum alvo vinculado ainda"}
              </div>

              <div style={previewLabelStyle}>Justificativa</div>
              <div
                style={{
                  color: justificativa
                    ? "var(--ink-muted)"
                    : "var(--ink-faint)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  marginBottom: 12,
                }}
              >
                {justificativa ||
                  "Sem justificativa a decisão vira registro sem racional"}
              </div>

              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          }
        >
          <FormField label="Tipo de decisão">
            <Select onChange={setTipo} options={TIPO_OPTIONS} value={tipo} />
          </FormField>

          <FormField label="Decisão">
            <Segmented
              onChange={setDecisao}
              options={DECISAO_OPTIONS}
              tone={tone}
              value={decisao}
            />
          </FormField>

          <FormField label="Tipo de alvo">
            <Segmented
              onChange={changeTargetType}
              options={TARGET_TYPE_OPTIONS}
              tone={tone}
              value={targetType}
            />
          </FormField>

          <EntityLinkField
            kind={targetType}
            label={targetType === "epic" ? "Epic" : "Tema"}
            onChange={setTarget}
            value={target}
          />

          <FormField label="Título">
            <TextInput
              onChange={setTitulo}
              placeholder="ex: Aprovar migração multi-tenant"
              value={titulo}
            />
          </FormField>

          <FormField label="Justificativa" required>
            <TextArea
              onChange={setJustificativa}
              placeholder="Racional que sustenta a decisão para quem auditar depois"
              required
              rows={3}
              value={justificativa}
            />
          </FormField>

          <FormField hint="separadas por vírgula" label="Tags">
            <TextInput
              onChange={setTagsInput}
              placeholder="tech-debt, budget"
              value={tagsInput}
            />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
