"use client";

// tags.tsx — Tag Rules, wired to the mature billing/tag-rules.ts server
// actions. Lists automated portfolio tagging rules ("SE campo operador
// valor → tag") with match counts and enable/disable switches, plus a
// create flow. Mirrors the cosmos.html screen-tags handoff
// (design_handoff_cosmos_full/screen-bundle-4.jsx TagsScreen).
import type { TagRule } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  Switch,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import {
  createTagRule,
  listTagRules,
  type TagRuleCondition,
  updateTagRule,
} from "@/app/actions/billing/tag-rules";
import type { TAG_RULE_OUTPUT_TONES } from "@/app/actions/billing/tag-rules.constants";
import { EmptyState } from "../empty-state";
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
  Select,
  TextInput,
  TonePicker,
} from "../modal-form";
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

/**
 * Uma condição da regra: "campo operador valor".
 *
 * Fica fora do modal porque é a única parte do formulário com estado próprio
 * de posição — a linha precisa saber se é a primeira (sem o "E" que a liga à
 * anterior) e se pode ser removida (a última que sobra, não).
 */
function RuleConditionRow({
  cond,
  onChange,
  onRemove,
  showConnector,
}: {
  cond: TagRuleCondition;
  onChange: (next: TagRuleCondition) => void;
  onRemove?: () => void;
  showConnector: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {showConnector && (
        <span
          style={{
            color: "var(--ink-faint)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".06em",
            paddingLeft: 4,
          }}
        >
          E
        </span>
      )}
      <div
        style={{
          alignItems: "center",
          display: "grid",
          gap: 6,
          gridTemplateColumns: "minmax(0,1fr) 92px minmax(0,1fr) 26px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <TextInput
            onChange={(v) => onChange({ ...cond, field: v })}
            placeholder="campo (ex: wsjf)"
            value={cond.field}
          />
        </div>
        <Select
          onChange={(v) =>
            onChange({ ...cond, operator: v as TagRuleCondition["operator"] })
          }
          options={OPERATOR_OPTIONS}
          value={cond.operator}
        />
        <div style={{ minWidth: 0 }}>
          <TextInput
            onChange={(v) => onChange({ ...cond, value: v })}
            placeholder="valor"
            value={cond.value}
          />
        </div>
        <button
          disabled={!onRemove}
          onClick={onRemove}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ink-faint)",
            cursor: onRemove ? "pointer" : "default",
            display: "grid",
            height: 26,
            opacity: onRemove ? 1 : 0.35,
            placeItems: "center",
            width: 26,
          }}
          title="Remover condição"
          type="button"
        >
          <Icon name="x" size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

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
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

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
  // O preview lê só as condições completas: uma linha pela metade descreveria
  // uma regra que não existe.
  const condText = conditionsToText(validConditions);

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
              <ModalShortcutHint salvar="criar" />
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
                  style={
                    canSave ? undefined : { opacity: 0.5, cursor: "default" }
                  }
                  variant="primary"
                >
                  {saving ? "Criando..." : "Criar regra"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="tag" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Automação condicional que rotula itens do portfólio continuamente"
        title="Nova regra"
        tone={outputTagTone}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${outputTagTone}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                className="display"
                style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}
              >
                {name || "Nome da regra"}
              </div>
              <div
                className="mono"
                style={{
                  background: "var(--surface-3)",
                  borderRadius: "var(--r-md)",
                  color: "var(--ink-muted)",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  marginBottom: 10,
                  padding: "8px 10px",
                }}
              >
                <span style={{ color: "var(--ink-faint)" }}>SE </span>
                {condText || "condição"}
                {scope.trim() && (
                  <>
                    <span style={{ color: "var(--ink-faint)" }}> em </span>
                    {scope}
                  </>
                )}
              </div>
              <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <span style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>
                  aplicar tag
                </span>
                <Badge icon="tag" tone={outputTagTone}>
                  {outputTag || "nome-da-tag"}
                </Badge>
              </div>
            </div>
          }
        >
          <FormField label="Nome da regra" required>
            <TextInput
              onChange={setName}
              placeholder="ex: Marcar épicos de alto valor"
              required
              value={name}
            />
          </FormField>

          <FormField
            hint="Texto livre que descreve onde a regra roda"
            label="Escopo"
          >
            <TextInput
              onChange={setScope}
              placeholder="ex: Épicos e Features"
              value={scope}
            />
          </FormField>

          <FormField
            hint="Todas as condições precisam bater (E) para a tag ser aplicada"
            label="Condições"
            required
          >
            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--r-md)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 12,
              }}
            >
              {conditions.map((c, i) => (
                <RuleConditionRow
                  cond={c}
                  key={`cond-${i}`}
                  onChange={(next) => updateCondition(i, next)}
                  onRemove={
                    // A última condição não sai: uma regra sem condição
                    // marcaria o portfólio inteiro.
                    conditions.length > 1 ? () => removeCondition(i) : undefined
                  }
                  showConnector={i > 0}
                />
              ))}
              <button
                onClick={addCondition}
                style={{
                  alignItems: "center",
                  alignSelf: "flex-start",
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 11.5,
                  fontWeight: 700,
                  gap: 5,
                  padding: "2px 0",
                }}
                type="button"
              >
                <Icon name="plus" size={11} strokeWidth={2.4} /> Adicionar
                condição (E)
              </button>
            </div>
          </FormField>

          <div
            style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}
          >
            <FormField label="Tag aplicada" required>
              <TextInput
                onChange={setOutputTag}
                placeholder="prioridade-máxima"
                required
                value={outputTag}
              />
            </FormField>
            <FormField label="Cor da tag">
              {/* Os seis tones do TonePicker são exatamente os aceitos por
                  TAG_RULE_OUTPUT_TONES, então a asserção não amplia o domínio. */}
              <TonePicker
                onChange={(v) => setOutputTagTone(v as OutputTone)}
                value={outputTagTone}
              />
            </FormField>
          </div>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
