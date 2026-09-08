"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useNav,
} from "@repo/design-system/cosmos/kit";
// strategy.tsx — Strategy Map: pillars grouping strategic themes, wired to
// listStrategyPillars(). Cards show a real epic-count/progress rollup
// (rolled up through themes -> epics, same aggregation getStrategyPillar()
// uses) and link to the pillar detail screen. Supports creating new pillars
// via NewPillarModal.
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import {
  assignThemeToPillar,
  createPillar,
  listStrategyPillars,
  listUnlinkedThemes,
  type PillarView,
  type UnlinkedThemeView,
} from "@/app/(cosmos)/actions/strategy";
import {
  ModalCard,
  ModalProvider,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import { DirtyProvider, FormField, TextInput, TonePicker } from "../modal-form";
import { useActionToast } from "../use-action-toast";

const HEALTH_TONE: Record<string, "green" | "amber" | "red"> = {
  on: "green",
  watch: "amber",
  behind: "red",
};

// StrategyPillar.tone is a free-form Prisma String column (default "accent"),
// not a Tone enum — validate against the known set instead of trusting it.
const VALID_TONES = new Set<Tone>([
  "green",
  "red",
  "amber",
  "blue",
  "purple",
  "accent",
  "neutral",
]);
function toTone(value: string): Tone {
  return VALID_TONES.has(value as Tone) ? (value as Tone) : "accent";
}

// Static reference copy — explains what the Strategy Map represents
// (SAFe 6.0 pillar -> theme -> epic rollup). Not a per-tenant vision value:
// StrategyPillar has no vision field in the schema, so nothing tenant-
// specific is fabricated here.
function VisionBanner() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--hairline)",
        background: "var(--accent-soft)",
        padding: "18px 20px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 44,
          height: 44,
          borderRadius: "var(--r-md)",
          flexShrink: 0,
          background: "var(--accent)",
          color: "var(--accent-fg)",
        }}
      >
        <Icon name="compass" size={20} />
      </span>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--accent-text)",
            marginBottom: 4,
          }}
        >
          Da estratégia ao épico
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--ink-muted)",
            lineHeight: 1.5,
          }}
        >
          Pilares estratégicos (SAFe 6.0) traduzem a estratégia do portfólio em
          apostas de investimento financiáveis. Cada pilar agrupa temas
          estratégicos, que se desdobram em épicos executáveis — o rollup abaixo
          reflete o progresso real desse trabalho.
        </div>
      </div>
    </div>
  );
}

function PillarCard({ pillar }: { pillar: PillarView }) {
  const { navigate } = useNav();
  const tone = toTone(pillar.tone);
  return (
    <SectionCard
      icon="anchor"
      onActivate={() => navigate("pillar", pillar.id)}
      subtitle={`${pillar.themes.length} temas`}
      title={pillar.name}
      tone={tone}
    >
      {pillar.themes.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          Nenhum tema vinculado.
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pillar.themes.map((theme) => {
            const healthTone = HEALTH_TONE[theme.healthStatus] ?? "green";
            return (
              <div
                key={theme.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--ink)" }}>{theme.title}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ color: "var(--ink-muted)" }}>
                    {theme.targetAllocationPct ?? "—"}%
                  </span>
                  <Badge dot tone={healthTone}>
                    {theme.healthStatus}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            marginBottom: 6,
          }}
        >
          <span style={{ color: "var(--ink-muted)", fontWeight: 600 }}>
            {pillar.epicCount} épicos
          </span>
          <span
            className="mono"
            style={{ fontWeight: 700, color: "var(--ink)" }}
          >
            {/* "—" e não "0%": pilar sem épico mensurável não tem média, e
                afirmar 0% seria afirmar uma medição que não existe. */}
            {pillar.avgProgress === null ? "—" : `${pillar.avgProgress}%`}
          </span>
        </div>
        <Progress tone={tone} value={pillar.avgProgress ?? 0} />
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

// story-031 AC-001: nó órfão aparece numa faixa de desalinhados em vez de
// sumir do mapa. Cada linha traz o caminho de saída — o select que vincula.
function UnalignedThemes({
  themes,
  pillars,
  onLinked,
}: {
  themes: UnlinkedThemeView[];
  pillars: PillarView[];
  onLinked: () => void;
}) {
  const [linking, setLinking] = useState<string | null>(null);

  const link = async (themeId: string, pillarId: string) => {
    if (linking) {
      return;
    }
    setLinking(themeId);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => assignThemeToPillar({ themeId, pillarId }),
      {
        loading: "Vinculando tema ao pilar...",
        success: "Tema vinculado ao pilar.",
        error: (err: string) => `Não foi possível vincular: ${err}`,
      }
    );
    setLinking(null);
    if (res.ok) {
      onLinked();
    }
  };

  return (
    <SectionCard
      icon="alert"
      subtitle={`${themes.length} ${themes.length === 1 ? "tema" : "temas"} sem pilar`}
      title="Fora de qualquer pilar"
      tone="amber"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {themes.map((theme) => (
          <div
            key={theme.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: "var(--ink)" }}>{theme.title}</span>
            <select
              aria-label={`Vincular ${theme.title} a um pilar`}
              onChange={(e) => {
                if (e.target.value) {
                  link(theme.id, e.target.value);
                }
              }}
              style={{ ...selectStyle, width: 220 }}
              value=""
            >
              <option value="">Vincular a um pilar…</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function NewPillarModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [tone, setTone] = useState("accent");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const create = async () => {
    if (!name.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => createPillar({ name: name.trim(), tone }),
      {
        loading: "Criando pilar estratégico...",
        success: "Pilar estratégico criado.",
        error: (err: string) => `Não foi possível criar o pilar: ${err}`,
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
                  {saving ? "Criando..." : "Criar pilar"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="trend" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Grande aposta de longo prazo do Strategy Map, guarda-chuva de temas e épicos"
        title="Novo pilar estratégico"
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
                <span
                  className="mono"
                  style={{ color: "var(--ink-faint)", fontSize: 10.5 }}
                >
                  Strategy Map
                </span>
              </div>
              <div
                className="display"
                style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 10 }}
              >
                {name || "Nome do pilar"}
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  lineHeight: 1.6,
                  paddingTop: 12,
                }}
              >
                0 temas vinculados — o pilar nasce vazio e recebe temas pela
                faixa "Fora de qualquer pilar".
              </div>
            </div>
          }
        >
          <FormField label="Nome do pilar" required>
            <TextInput
              onChange={setName}
              placeholder="ex: Confiabilidade e escala"
              required
              value={name}
            />
          </FormField>
          <FormField label="Cor / tone">
            <TonePicker onChange={setTone} value={tone} />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

function StrategyBody() {
  const modal = useModal();
  const [pillars, setPillars] = useState<PillarView[]>([]);
  const [unaligned, setUnaligned] = useState<UnlinkedThemeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([listStrategyPillars(), listUnlinkedThemes()]).then(
      ([pillarsRes, unalignedRes]) => {
        if (pillarsRes.ok) {
          setPillars(pillarsRes.data);
          setError(false);
        } else {
          // Antes daqui a falha caía no mesmo texto do vazio e a tela dizia
          // "nenhum pilar cadastrado" para um tenant que tem pilares.
          setError(true);
        }
        if (unalignedRes.ok) {
          setUnaligned(unalignedRes.data);
        }
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Estratégia"
        meta={<Badge tone="accent">{pillars.length} pilares</Badge>}
        subtitle="Pilares estratégicos e os temas que os compõem."
        title="Strategy Map"
      >
        <Button
          icon="plus"
          onClick={() => modal.open(<NewPillarModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Novo pilar
        </Button>
      </PageHeader>
      <VisionBanner />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <ErrorState message="Não foi possível carregar os pilares estratégicos." />
        )}
        {!(error || loading) && pillars.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhum pilar estratégico cadastrado.
          </span>
        )}
        {!error && pillars.map((p) => <PillarCard key={p.id} pillar={p} />)}
        {!error && unaligned.length > 0 && (
          <UnalignedThemes
            onLinked={load}
            pillars={pillars}
            themes={unaligned}
          />
        )}
      </div>
    </div>
  );
}

export default function StrategyScreen() {
  return (
    <ModalProvider>
      <StrategyBody />
    </ModalProvider>
  );
}
