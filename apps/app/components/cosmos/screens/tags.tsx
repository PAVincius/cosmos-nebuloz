"use client";

// tags.tsx — Tag Rules, wired to the mature billing/tag-rules.ts server
// actions. Lists automated portfolio tagging rules ("SE campo operador
// valor → tag") with match counts and enable/disable switches, plus a
// create flow. Mirrors the cosmos.html screen-tags handoff
// (design_handoff_cosmos_full/screen-bundle-4.jsx TagsScreen).
import type { TagRule } from "@repo/database";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  createTagRule,
  listTagRules,
  type TagRuleCondition,
  updateTagRule,
} from "@/app/actions/billing/tag-rules";
import { TAG_RULE_OUTPUT_TONES } from "@/app/actions/billing/tag-rules.constants";
import { EmptyState } from "../empty-state";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  Switch,
  type Tone,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

type OutputTone = (typeof TAG_RULE_OUTPUT_TONES)[number];

const OPERATOR_OPTIONS: {
  value: TagRuleCondition["operator"];
  label: string;
}[] = [
  { value: "eq", label: "=" },
  { value: "contains", label: "contém" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
];

const OPERATOR_LABEL: Record<TagRuleCondition["operator"], string> =
  Object.fromEntries(OPERATOR_OPTIONS.map((o) => [o.value, o.label])) as Record<
    TagRuleCondition["operator"],
    string
  >;

function isTagRuleCondition(v: unknown): v is TagRuleCondition {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as TagRuleCondition).field === "string" &&
    typeof (v as TagRuleCondition).value === "string" &&
    ["eq", "contains", "gte", "lte"].includes((v as TagRuleCondition).operator)
  );
}

function parseConditions(
  conditions: TagRule["conditions"]
): TagRuleCondition[] {
  return Array.isArray(conditions) ? conditions.filter(isTagRuleCondition) : [];
}

function conditionsToText(conditions: TagRuleCondition[]): string {
  return conditions
    .map((c) => `${c.field} ${OPERATOR_LABEL[c.operator]} ${c.value}`)
    .join(" E ");
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

function NewTagRuleModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [outputTag, setOutputTag] = useState("");
  const [outputTagTone, setOutputTagTone] = useState<OutputTone>("accent");
  const [conditions, setConditions] = useState<TagRuleCondition[]>([
    { field: "", operator: "eq", value: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const updateCondition = (i: number, next: TagRuleCondition) => {
    setConditions((cs) => cs.map((c, ci) => (ci === i ? next : c)));
  };
  const addCondition = () => {
    setConditions((cs) => [...cs, { field: "", operator: "eq", value: "" }]);
  };
  const removeCondition = (i: number) => {
    setConditions((cs) => cs.filter((_, ci) => ci !== i));
  };

  const validConditions = conditions.filter(
    (c) => c.field.trim() && c.value.trim()
  );
  const canSave =
    name.trim() && outputTag.trim() && validConditions.length > 0 && !saving;

  const create = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createTagRule({
          name: name.trim(),
          scope: scope.trim() || undefined,
          outputTag: outputTag.trim(),
          outputTagTone,
          conditions: validConditions,
          matchType: "EXACT",
          enabled: true,
          priority: 0,
        }),
      {
        loading: "Criando regra...",
        success: "Regra de tag criada.",
        error: (err: string) => `Não foi possível criar a regra: ${err}`,
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
      icon={<Icon name="tag" size={16} strokeWidth={2.4} />}
      subtitle="Automação condicional que rotula itens do portfólio continuamente"
      title="Nova regra"
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="tagrule-name" style={fieldLabelStyle}>
            Nome da regra
          </label>
          <input
            id="tagrule-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Marcar épicos de alto valor"
            style={inputStyle}
            value={name}
          />
        </div>

        <div>
          <label htmlFor="tagrule-scope" style={fieldLabelStyle}>
            Escopo (opcional)
          </label>
          <input
            id="tagrule-scope"
            onChange={(e) => setScope(e.target.value)}
            placeholder="ex: Épicos e Features"
            style={inputStyle}
            value={scope}
          />
        </div>

        <div>
          <label style={fieldLabelStyle}>Condições</label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "10px 10px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline-strong)",
              background: "var(--surface-2)",
            }}
          >
            {conditions.map((c, i) => (
              <div
                key={`cond-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 96px 1fr 28px",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <input
                  onChange={(e) =>
                    updateCondition(i, { ...c, field: e.target.value })
                  }
                  placeholder="campo (ex: wsjf)"
                  style={inputStyle}
                  value={c.field}
                />
                <select
                  onChange={(e) =>
                    updateCondition(i, {
                      ...c,
                      operator: e.target.value as TagRuleCondition["operator"],
                    })
                  }
                  style={selectStyle}
                  value={c.operator}
                >
                  {OPERATOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  onChange={(e) =>
                    updateCondition(i, { ...c, value: e.target.value })
                  }
                  placeholder="valor"
                  style={inputStyle}
                  value={c.value}
                />
                <button
                  disabled={conditions.length <= 1}
                  onClick={() => removeCondition(i)}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 28,
                    height: 28,
                    border: "none",
                    background: "transparent",
                    color: "var(--ink-faint)",
                    cursor: conditions.length > 1 ? "pointer" : "default",
                    opacity: conditions.length > 1 ? 1 : 0.35,
                  }}
                  title="Remover condição"
                  type="button"
                >
                  <Icon name="x" size={14} strokeWidth={2.2} />
                </button>
              </div>
            ))}
            <button
              onClick={addCondition}
              style={{
                alignSelf: "flex-start",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 0",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
              type="button"
            >
              <Icon name="plus" size={11} strokeWidth={2.4} /> Adicionar
              condição (E)
            </button>
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label htmlFor="tagrule-tag" style={fieldLabelStyle}>
              Tag aplicada
            </label>
            <input
              id="tagrule-tag"
              onChange={(e) => setOutputTag(e.target.value)}
              placeholder="prioridade-máxima"
              style={inputStyle}
              value={outputTag}
            />
          </div>
          <div>
            <label htmlFor="tagrule-tone" style={fieldLabelStyle}>
              Cor da tag
            </label>
            <select
              id="tagrule-tone"
              onChange={(e) => setOutputTagTone(e.target.value as OutputTone)}
              style={selectStyle}
              value={outputTagTone}
            >
              {TAG_RULE_OUTPUT_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button
            onClick={create}
            size="sm"
            style={canSave ? undefined : { opacity: 0.5, cursor: "default" }}
            variant="primary"
          >
            Criar regra
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function TagRuleRow({
  rule,
  onToggled,
}: {
  rule: TagRule;
  onToggled: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const conditions = parseConditions(rule.conditions);
  const condText = conditionsToText(conditions);
  const tone = (rule.outputTagTone as Tone) || "accent";

  const toggle = async () => {
    if (toggling) {
      return;
    }
    setToggling(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => updateTagRule(rule.id, { enabled: !rule.enabled }),
      {
        loading: rule.enabled ? "Desativando regra..." : "Ativando regra...",
        success: rule.enabled ? "Regra desativada." : "Regra ativada.",
        error: (err: string) => `Não foi possível atualizar a regra: ${err}`,
      }
    );
    setToggling(false);
    if (res.ok) {
      onToggled();
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.4fr) 150px 92px 46px",
        alignItems: "center",
        gap: 18,
        padding: "15px 18px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: rule.enabled ? "var(--surface)" : "var(--surface-2)",
        opacity: rule.enabled ? 1 : 0.72,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "block",
          }}
        >
          {rule.name || rule.outputTag || "Regra sem nome"}
        </span>
        {rule.scope && (
          <span style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>
            {rule.scope}
          </span>
        )}
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--ink-faint)",
            letterSpacing: ".05em",
          }}
        >
          SE
        </span>
        <span
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            background: "var(--surface-3)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            padding: "5px 9px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {condText || "sem condições"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon
          name="arrowRight"
          size={14}
          style={{ color: "var(--ink-faint)" }}
        />
        <Badge icon="tag" tone={tone}>
          {rule.outputTag || "—"}
        </Badge>
      </div>
      <div style={{ textAlign: "center" }}>
        <span
          className="mono"
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: rule.matchCount > 0 ? "var(--ink)" : "var(--ink-faint)",
          }}
        >
          {rule.matchCount}
        </span>
        <div
          style={{
            fontSize: 10,
            color: "var(--ink-subtle)",
            fontWeight: 600,
            letterSpacing: ".03em",
          }}
        >
          ITENS
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Switch on={rule.enabled} onClick={toggle} />
      </div>
    </div>
  );
}

function TagsBody() {
  const modal = useModal();
  const [rules, setRules] = useState<TagRule[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listTagRules().then((r) => {
      if (r.ok) {
        setRules(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = rules.filter((r) => r.enabled).length;
  const tagged = rules.reduce(
    (sum, r) => sum + (r.enabled ? r.matchCount : 0),
    0
  );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Automação"
        meta={
          <>
            <Badge icon="tag" tone="accent">
              {rules.length} regras
            </Badge>
            <Badge dot tone="green">
              {active} ativas
            </Badge>
          </>
        }
        subtitle="Automação de rótulos no portfólio. Regras condicionais aplicam tags a épicos, features e value streams continuamente."
        title="Tag Rules"
      >
        <Button
          icon="plus"
          onClick={() => modal.open(<NewTagRuleModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Nova regra
        </Button>
      </PageHeader>

      {error && <ErrorState message="Não foi possível carregar as regras." />}

      {!error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: "var(--gap)",
            marginBottom: "var(--gap)",
          }}
        >
          <KpiCard
            hint={`de ${rules.length} configuradas`}
            icon="tag"
            label="Regras ativas"
            tone="accent"
            value={active}
          />
          <KpiCard
            hint="aplicado pelas regras ativas"
            icon="zap"
            label="Itens marcados automaticamente"
            tone="purple"
            value={tagged}
          />
        </div>
      )}

      <SectionCard
        bodyStyle={{ padding: 12 }}
        icon="sliders"
        subtitle="Condição → rótulo aplicado"
        title="Regras de automação"
        tone="accent"
      >
        {!(error || loading) && rules.length === 0 && (
          <EmptyState
            action={{
              label: "Nova regra",
              onClick: () => modal.open(<NewTagRuleModal onCreated={load} />),
            }}
            description="Crie regras condicionais para rotular épicos, features e value streams automaticamente."
            icon="tag"
            title="Nenhuma regra de tag configurada"
          />
        )}
        {!(error || loading) && rules.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.map((r) => (
              <TagRuleRow key={r.id} onToggled={load} rule={r} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function TagsScreen() {
  return (
    <ModalProvider>
      <TagsBody />
    </ModalProvider>
  );
}
