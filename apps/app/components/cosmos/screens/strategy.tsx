"use client";

// strategy.tsx — Strategy Map: pillars grouping strategic themes, wired to
// listStrategyPillars(). Supports creating new pillars via NewPillarModal;
// theme detail drill-down remains out of scope for this pass.
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import {
  createPillar,
  listStrategyPillars,
  type PillarView,
} from "@/app/(cosmos)/actions/strategy";
import { Badge, Button, PageHeader, SectionCard, type Tone } from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
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

const TONE_LABEL: Record<Tone, string> = {
  green: "Verde",
  red: "Vermelho",
  amber: "Âmbar",
  blue: "Azul",
  purple: "Roxo",
  accent: "Destaque",
  neutral: "Neutro",
};

function PillarCard({ pillar }: { pillar: PillarView }) {
  return (
    <SectionCard
      icon="anchor"
      subtitle={`${pillar.themes.length} temas`}
      title={pillar.name}
      tone={toTone(pillar.tone)}
    >
      {pillar.themes.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          Nenhum tema vinculado.
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pillar.themes.map((theme) => {
            const tone = HEALTH_TONE[theme.healthStatus] ?? "green";
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
                  <Badge dot tone={tone}>
                    {theme.healthStatus}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
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

function NewPillarModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [tone, setTone] = useState<Tone>("accent");
  const [saving, setSaving] = useState(false);

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

  return (
    <ModalCard
      subtitle="Adicionar um pilar estratégico ao portfólio"
      title="Novo pilar estratégico"
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="pillar-name" style={fieldLabelStyle}>
            Nome
          </label>
          <input
            autoFocus
            id="pillar-name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                create();
              }
            }}
            placeholder="Ex: Crescimento…"
            style={selectStyle}
            value={name}
          />
        </div>

        <div>
          <label htmlFor="pillar-tone" style={fieldLabelStyle}>
            Cor
          </label>
          <select
            id="pillar-tone"
            onChange={(e) => setTone(e.target.value as Tone)}
            style={selectStyle}
            value={tone}
          >
            {Array.from(VALID_TONES).map((t) => (
              <option key={t} value={t}>
                {TONE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar pilar
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function StrategyBody() {
  const modal = useModal();
  const [pillars, setPillars] = useState<PillarView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listStrategyPillars().then((r) => {
      if (r.ok) {
        setPillars(r.data);
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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!loading && pillars.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhum pilar estratégico cadastrado.
          </span>
        )}
        {pillars.map((p) => (
          <PillarCard key={p.id} pillar={p} />
        ))}
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
