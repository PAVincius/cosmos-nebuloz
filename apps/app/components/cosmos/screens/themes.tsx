"use client";

// themes.tsx — Temas Estratégicos (portfolio investment themes), wired to
// listThemes(). Card grid: health, target allocation, epic count, avg progress.
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import {
  createTheme,
  listThemes,
  rebalanceThemeTargets,
  type ThemeView,
} from "@/app/(cosmos)/actions/themes";
import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const HEALTH_TONE: Record<string, "green" | "amber" | "red"> = {
  on: "green",
  watch: "amber",
  behind: "red",
};

function ThemeCard({ theme }: { theme: ThemeView }) {
  const { navigate } = useNav();
  const tone = HEALTH_TONE[theme.healthStatus] ?? "green";
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
          }}
        >
          <span style={{ color: "var(--ink-muted)" }}>Alocação-alvo</span>
          <span
            className="mono"
            style={{ fontWeight: 700, color: "var(--ink)" }}
          >
            {theme.targetAllocationPct ?? "—"}%
          </span>
        </div>
        <Progress tone={tone} value={theme.avgProgress} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--ink-faint)",
          }}
        >
          <span>{theme.epicCount} épicos</span>
          <span>{theme.horizon ?? "—"}</span>
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

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

function NewThemeModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [saving, setSaving] = useState(false);

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
          budgetTotal: budgetTotal.trim() ? Number(budgetTotal) : undefined,
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

  return (
    <ModalCard
      subtitle="Adicionar um tema estratégico ao portfólio"
      title="Novo tema estratégico"
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="theme-title" style={fieldLabelStyle}>
            Título
          </label>
          <input
            autoFocus
            id="theme-title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                create();
              }
            }}
            placeholder="Ex: Expansão LATAM…"
            style={selectStyle}
            value={title}
          />
        </div>

        <div>
          <label htmlFor="theme-description" style={fieldLabelStyle}>
            Descrição
          </label>
          <textarea
            id="theme-description"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Objetivo estratégico do tema…"
            rows={3}
            style={{ ...selectStyle, resize: "vertical" }}
            value={description}
          />
        </div>

        <div>
          <label htmlFor="theme-budget" style={fieldLabelStyle}>
            Investimento (orçamento total)
          </label>
          <input
            id="theme-budget"
            min={0}
            onChange={(e) => setBudgetTotal(e.target.value)}
            placeholder="Ex: 250000"
            style={selectStyle}
            type="number"
            value={budgetTotal}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar tema
          </Button>
        </div>
      </div>
    </ModalCard>
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

  const load = useCallback(() => {
    setLoading(true);
    listThemes().then((r) => {
      if (r.ok) {
        setThemes(r.data);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Estratégia"
        meta={<Badge tone="accent">{themes.length} temas</Badge>}
        subtitle="Alocação de investimento por tema, alinhada à estratégia de portfólio."
        title="Temas Estratégicos"
      >
        <Button
          icon="scale"
          onClick={() =>
            modal.open(<RebalanceTargetsModal onSaved={load} themes={themes} />)
          }
          size="md"
          variant="secondary"
        >
          Rebalancear alocação
        </Button>
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
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {!loading && themes.length === 0 && (
          <KpiCard
            hint="Crie um tema estratégico"
            icon="target"
            label="Nenhum tema"
            tone="accent"
            value="—"
          />
        )}
        {themes.map((t) => (
          <ThemeCard key={t.id} theme={t} />
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
