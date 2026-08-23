"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  IconButton,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useAction,
  useNav,
} from "@repo/design-system/cosmos/kit";
// themes.tsx — Temas Estratégicos (portfolio investment themes), wired to
// listThemes(). KPI row + card grid: health, target-vs-actual allocation
// (BillingEntryAllocation-derived, see actions/themes.ts), epic count.
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import {
  archiveTheme,
  createTheme,
  listThemeLinkOptions,
  listThemes,
  rebalanceThemeTargets,
  type ThemeLinkOptions,
  type ThemeView,
} from "@/app/(cosmos)/actions/themes";
import {
  ARCHIVED_THEME_STATUS,
  THEME_CONCENTRATION_THRESHOLD_PCT,
} from "@/app/(cosmos)/actions/themes.constants";
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
  EntityLinkField,
  FormField,
  TextArea,
  TextInput,
  TonePicker,
} from "../modal-form";
import { useActionToast } from "../use-action-toast";

const HEALTH_TONE: Record<string, "green" | "amber" | "red"> = {
  on: "green",
  watch: "amber",
  behind: "red",
};

// Portfolio-wide KPIs derived from the themes already returned by
// listThemes() — no extra round trip. Every value degrades to null (never a
// fabricated number) when the underlying data isn't there yet.
function computeThemeKpis(themes: ThemeView[]) {
  const withActual = themes.filter((t) => t.actualAllocationPct !== null);
  // % of the target-weighted portfolio (targets sum to 100 once rebalanced)
  // that has real cost data mapped to it.
  const mappedInvestmentPct = withActual.length
    ? Math.round(
        withActual.reduce((s, t) => s + (t.targetAllocationPct ?? 0), 0)
      )
    : null;
  const epicsUnderThemes = themes.reduce((s, t) => s + t.epicCount, 0);
  const withBoth = themes.filter(
    (t) => t.actualAllocationPct !== null && t.targetAllocationPct !== null
  );
  const targetAdherencePct = withBoth.length
    ? Math.round(
        Math.max(
          0,
          Math.min(
            100,
            100 -
              withBoth.reduce(
                (s, t) =>
                  s +
                  Math.abs(
                    (t.actualAllocationPct as number) -
                      (t.targetAllocationPct as number)
                  ),
                0
              ) /
                withBoth.length
          )
        )
      )
    : null;
  return { mappedInvestmentPct, epicsUnderThemes, targetAdherencePct };
}

function ThemeCard({
  theme,
  onArchived,
}: {
  theme: ThemeView;
  onArchived: () => void;
}) {
  const { navigate } = useNav();
  const [archiving, setArchiving] = useState(false);
  const tone = HEALTH_TONE[theme.healthStatus] ?? "green";
  const hasDrift =
    theme.actualAllocationPct !== null && theme.targetAllocationPct !== null;
  const drift = hasDrift
    ? Math.round(
        (theme.actualAllocationPct as number) -
          (theme.targetAllocationPct as number)
      )
    : null;

  const archive = async () => {
    if (archiving) {
      return;
    }
    setArchiving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => archiveTheme({ id: theme.id }), {
      loading: "Arquivando tema estratégico...",
      success: "Tema estratégico arquivado.",
      error: (err: string) => `Não foi possível arquivar o tema: ${err}`,
    });
    setArchiving(false);
    if (res.ok) {
      onArchived();
    }
  };

  return (
    <SectionCard
      action={
        <Badge dot tone={tone}>
          {theme.healthStatus}
        </Badge>
      }
      onActivate={() => navigate("theme", theme.id)}
      subtitle={theme.description ?? undefined}
      title={theme.title}
      tone={tone}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
          }}
        >
          <span style={{ color: "var(--ink-muted)" }}>
            {theme.actualAllocationPct !== null
              ? "Real vs. alvo"
              : "Alocação-alvo"}
          </span>
          <span
            className="mono"
            style={{ fontWeight: 700, color: "var(--ink)" }}
          >
            {theme.actualAllocationPct !== null
              ? `${theme.actualAllocationPct}%`
              : `${theme.targetAllocationPct ?? "—"}%`}
            {theme.actualAllocationPct !== null &&
              theme.targetAllocationPct !== null &&
              ` / alvo ${theme.targetAllocationPct}%`}
          </span>
        </div>
        {theme.actualAllocationPct !== null ? (
          <div style={{ position: "relative" }}>
            <Progress tone={tone} value={theme.actualAllocationPct} />
            {theme.targetAllocationPct !== null && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  bottom: -2,
                  left: `${theme.targetAllocationPct}%`,
                  width: 2,
                  background: "var(--ink-faint)",
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            Sem dados de alocação real
          </span>
        )}
        {drift !== null && drift !== 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: drift > 0 ? "var(--amber-text)" : "var(--blue-text)",
            }}
          >
            {drift > 0
              ? `+${drift}pp acima do alvo`
              : `${drift}pp abaixo do alvo`}
          </span>
        )}
        {theme.overConcentrated && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--amber-text)",
            }}
          >
            {`${theme.epicSharePct}% dos épicos — acima da diretriz de ${THEME_CONCENTRATION_THRESHOLD_PCT}%`}
          </span>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--ink-faint)",
          }}
        >
          <span>{theme.epicCount} épicos</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{theme.horizon ?? "—"}</span>
            <IconButton
              name="inbox"
              onClick={archive}
              size={28}
              title={`Arquivar ${theme.title}`}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

const selectStyle: CSSProperties = {
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

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

function NewThemeModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("purple");
  const [target, setTarget] = useState("15");
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [epicIds, setEpicIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // Budgets e épicos vinculáveis. Carrega uma vez, ao abrir: os dois campos
  // de busca compartilham a mesma viagem.
  const { data: opcoes } = useAction<ThemeLinkOptions>(
    () => listThemeLinkOptions(),
    []
  );

  const budgets = opcoes?.budgets ?? [];
  const epics = opcoes?.epics ?? [];
  const budget = budgets.find((b) => b.id === budgetId);
  const alvo = Number(target) || 0;
  // Quanto do lean budget do portfólio esta aposta consome, comparado ao que
  // ela deveria consumir — é a pergunta que o tema existe para responder.
  const totalPortfolio = opcoes?.budgetTotalPortfolio ?? 0;
  const alocado =
    budget && totalPortfolio > 0
      ? Math.round(((budget.amount ?? 0) / totalPortfolio) * 100)
      : 0;
  const desvio = alocado - alvo;

  const create = async () => {
    if (!title.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createTheme({
          title: title.trim(),
          description: description.trim() || undefined,
          tone: tone as
            | "accent"
            | "blue"
            | "purple"
            | "green"
            | "amber"
            | "red",
          ...(target.trim() ? { targetAllocationPct: alvo } : {}),
          ...(budgetId ? { leanBudgetId: budgetId } : {}),
          ...(epicIds.length > 0 ? { epicIds } : {}),
        }),
      {
        loading: "Criando tema estratégico...",
        success: "Tema estratégico criado.",
        error: (err: string) => `Não foi possível criar o tema: ${err}`,
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
                  variant="primary"
                >
                  {saving ? "Criando..." : "Criar tema"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="target" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Aposta de investimento do portfólio — vinculada a um budget aprovado e aos épicos que a compõem"
        title="Novo Tema Estratégico"
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
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    background: `var(--${tone})`,
                    borderRadius: 99,
                    height: 10,
                    width: 10,
                  }}
                />
                <div
                  className="display"
                  style={{ fontSize: 14.5, fontWeight: 700 }}
                >
                  {title || "Nome do tema"}
                </div>
              </div>
              <div
                style={{
                  color: "var(--ink-muted)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  marginBottom: 14,
                }}
              >
                {description || "Descrição da aposta estratégica..."}
              </div>

              <div style={previewLabelStyle}>Budget alocado</div>
              {budget ? (
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {budget.label}
                  </span>
                  <Badge tone="neutral">{budget.sub}</Badge>
                </div>
              ) : (
                <div
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  Nenhum budget vinculado ainda
                </div>
              )}

              <div
                style={{
                  color: "var(--ink-faint)",
                  display: "flex",
                  fontSize: 11,
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span>{`Alocado ~${alocado}%`}</span>
                <span>{`Alvo ${alvo}%`}</span>
              </div>
              <div
                style={{
                  background: "var(--surface-3)",
                  borderRadius: 99,
                  height: 6,
                  marginBottom: 8,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    background: `var(--${tone})`,
                    height: "100%",
                    width: `${Math.min(100, alocado)}%`,
                  }}
                />
                {/* Marca do alvo: sem ela a barra diz "quanto", nunca "quanto
                    a mais ou a menos". */}
                <div
                  style={{
                    background: "var(--ink)",
                    height: 10,
                    left: `${Math.min(100, alvo)}%`,
                    position: "absolute",
                    top: -2,
                    width: 2,
                  }}
                />
              </div>
              <div
                style={{
                  color:
                    Math.abs(desvio) > 5
                      ? "var(--amber-text)"
                      : "var(--ink-faint)",
                  fontSize: 11,
                  marginBottom: 14,
                }}
              >
                {budget
                  ? Math.abs(desvio) > 5
                    ? `⚠ desvio de ${desvio > 0 ? "+" : ""}${desvio}pp do alvo`
                    : "Dentro da faixa alvo"
                  : "Vincule um budget para calcular o desvio"}
              </div>

              <div style={previewLabelStyle}>
                {`Épicos vinculados (${epicIds.length})`}
              </div>
              {epicIds.length === 0 ? (
                <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                  Nenhum épico vinculado ainda
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {epicIds.map((id) => (
                    <div key={id} style={{ color: "var(--ink)", fontSize: 12 }}>
                      {`· ${epics.find((x) => x.id === id)?.label ?? id}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
        >
          <FormField label="Nome do tema" required>
            <TextInput
              onChange={setTitle}
              placeholder="ex: Modernização da Plataforma"
              required
              value={title}
            />
          </FormField>
          <FormField label="Descrição">
            <TextArea
              onChange={setDescription}
              placeholder="O que esta aposta estratégica entrega, e por quê"
              rows={3}
              value={description}
            />
          </FormField>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <FormField label="Cor / tone">
              <TonePicker onChange={setTone} value={tone} />
            </FormField>
            <FormField label="Alvo de orçamento (%)">
              <TextInput onChange={setTarget} type="number" value={target} />
            </FormField>
          </div>

          <EntityLinkField
            hint="Aloca o investimento deste tema a um Value Stream existente"
            items={budgets}
            label="Budget / Value Stream"
            onChange={(v) => setBudgetId(v as string | null)}
            placeholder="Buscar um budget já aprovado..."
            tone={tone}
            value={budgetId}
          />

          <EntityLinkField
            hint="Épicos que compõem este tema — só aparecem os que ainda não têm tema"
            items={epics}
            label="Épicos"
            multi
            onChange={(v) => setEpicIds((v as string[]) ?? [])}
            placeholder="Buscar épicos existentes..."
            tone={tone}
            value={epicIds}
          />
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

function RebalanceTargetsModal({
  themes,
  onSaved,
}: {
  themes: ThemeView[];
  onSaved?: () => void;
}) {
  const { close } = useModal();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      themes.map((t) => [t.id, String(t.targetAllocationPct ?? 0)])
    )
  );
  const [saving, setSaving] = useState(false);

  const total = themes.reduce(
    (sum, t) => sum + (Number.parseFloat(values[t.id]) || 0),
    0
  );
  const sumValid = Math.abs(total - 100) < 0.01;

  const save = async () => {
    if (!sumValid || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        rebalanceThemeTargets({
          targets: themes.map((t) => ({
            themeId: t.id,
            targetAllocationPct: Number.parseFloat(values[t.id]) || 0,
          })),
        }),
      {
        loading: "Rebalanceando alocação...",
        success: "Alocação rebalanceada.",
        error: (err: string) => `Não foi possível rebalancear: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onSaved?.();
    }
  };

  return (
    <ModalCard
      subtitle="Ajustar a alocação-alvo (%) de cada tema — a soma deve fechar em 100%"
      title="Rebalancear alocação"
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {themes.map((t) => (
          <div
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 13.5,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t.title}
            </span>
            <input
              max={100}
              min={0}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [t.id]: e.target.value }))
              }
              style={{ ...selectStyle, width: 90 }}
              type="number"
              value={values[t.id]}
            />
          </div>
        ))}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
            fontWeight: 700,
            color: sumValid ? "var(--green-text)" : "var(--red-text)",
          }}
        >
          <span>Total</span>
          <span className="mono">
            {total.toFixed(2)}% {sumValid ? "" : "— deve somar 100%"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button
            onClick={save}
            size="sm"
            style={
              sumValid && !saving
                ? undefined
                : { opacity: 0.5, cursor: "not-allowed" }
            }
            variant="primary"
          >
            Salvar rebalanceamento
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function ThemesBody() {
  const modal = useModal();
  const [themes, setThemes] = useState<ThemeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listThemes().then((r) => {
      // Falha nunca degrada para lista vazia silenciosa: sem isto a tela
      // dizia "nenhum tema" para um tenant que tem temas e um erro de leitura.
      setThemes(r.ok ? r.data : []);
      setError(r.ok ? null : r.error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tema arquivado sai do portfólio ativo: não entra no grid, nos KPIs nem no
  // rebalanceamento — mas a contagem fica visível para arquivar não parecer
  // apagar (FR-014, UC-62).
  const active = themes.filter((t) => t.status !== ARCHIVED_THEME_STATUS);
  const archivedCount = themes.length - active.length;
  const kpis = computeThemeKpis(active);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Estratégia"
        meta={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge tone="accent">
              {`${active.length} ${active.length === 1 ? "tema" : "temas"}`}
            </Badge>
            {archivedCount > 0 && (
              <Badge>
                {`${archivedCount} ${archivedCount === 1 ? "arquivado" : "arquivados"}`}
              </Badge>
            )}
          </div>
        }
        subtitle="Alocação de investimento por tema, alinhada à estratégia de portfólio."
        title="Temas Estratégicos"
      >
        {/* Rebalancear zero temas não existe como operação: sem tema ativo
        carregado (ainda buscando, ou tenant sem nenhum) o botão some, e
        "Novo tema" ao lado segue sendo o caminho. */}
        {active.length > 0 && (
          <Button
            icon="scale"
            onClick={() =>
              modal.open(
                <RebalanceTargetsModal onSaved={load} themes={active} />
              )
            }
            size="md"
            variant="secondary"
          >
            Rebalancear alocação
          </Button>
        )}
        <Button
          icon="plus"
          onClick={() => modal.open(<NewThemeModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Novo tema
        </Button>
      </PageHeader>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <KpiCard
          hint="do orçamento-alvo do portfólio"
          icon="compass"
          label="Investimento mapeado"
          tone="accent"
          unit={kpis.mappedInvestmentPct === null ? undefined : "%"}
          value={kpis.mappedInvestmentPct ?? "—"}
        />
        <KpiCard
          hint="vinculados a temas"
          icon="layers"
          label="Épicos sob temas"
          tone="purple"
          value={kpis.epicsUnderThemes}
        />
        <KpiCard
          hint="média entre temas com dados reais"
          icon="gauge"
          label="Aderência ao alvo"
          tone="green"
          unit={kpis.targetAdherencePct === null ? undefined : "%"}
          value={kpis.targetAdherencePct ?? "—"}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {error !== null && (
          <span style={{ fontSize: 13, color: "var(--red-text)" }}>
            Não foi possível carregar os temas estratégicos.
          </span>
        )}
        {!(loading || error) && active.length === 0 && (
          <KpiCard
            hint="Crie um tema estratégico"
            icon="target"
            label="Nenhum tema"
            tone="accent"
            value="—"
          />
        )}
        {active.map((t) => (
          <ThemeCard key={t.id} onArchived={load} theme={t} />
        ))}
      </div>
    </div>
  );
}

export default function ThemesScreen() {
  return (
    <ModalProvider>
      <ThemesBody />
    </ModalProvider>
  );
}
