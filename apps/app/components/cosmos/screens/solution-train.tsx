"use client";

// solution-train.tsx — Solution Train, wired to listSolutionTrains() +
// createCapability(). Rollup counts only — aggregated Program Board/ROAM/
// flow-metrics at Solution level (RF-80) are NOT wired; that's a follow-up
// plan, not this tier.
import type { CSSProperties } from "react";
import { useState } from "react";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import {
  createCapability,
  listSolutionTrains,
  type SolutionTrainCapabilityView,
} from "@/app/(cosmos)/actions/solution-train";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  useAction,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "ANALYZING", label: "Em análise" },
  { value: "IMPLEMENTING", label: "Implementando" },
  { value: "DONE", label: "Concluída" },
];

const CAPABILITY_STATUS_TONE: Record<
  string,
  "neutral" | "amber" | "accent" | "green"
> = {
  BACKLOG: "neutral",
  ANALYZING: "amber",
  IMPLEMENTING: "accent",
  DONE: "green",
};

function capabilityStatusLabel(status: string): string {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
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

function NewCapabilityModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(STATUS_OPTIONS[0].value);
  const [milestone, setMilestone] = useState("");
  const [solutionTrain, setSolutionTrain] = useState<EntityOption | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createCapability({
          title: title.trim(),
          description: description.trim() || undefined,
          status: status as "BACKLOG" | "ANALYZING" | "IMPLEMENTING" | "DONE",
          milestone: milestone.trim() || undefined,
          solutionTrainId: solutionTrain?.id,
        }),
      {
        loading: "Criando capability...",
        success: "Capability criada.",
        error: (err: string) => `Não foi possível criar a capability: ${err}`,
      }
    );
    setSaving(false);
    close();
    if (res.ok) {
      onCreated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="target" size={16} strokeWidth={2.4} />}
      subtitle="Registrar uma nova capability de Solution Train"
      title="Nova capability"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="capability-title" style={fieldLabelStyle}>
            Título
          </label>
          <input
            id="capability-title"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome da capability…"
            style={inputStyle}
            value={title}
          />
        </div>

        <div>
          <label htmlFor="capability-description" style={fieldLabelStyle}>
            Descrição (opcional)
          </label>
          <textarea
            id="capability-description"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição da capability…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            value={description}
          />
        </div>

        <div>
          <label htmlFor="capability-status" style={fieldLabelStyle}>
            Status
          </label>
          <select
            id="capability-status"
            onChange={(e) => setStatus(e.target.value)}
            style={selectStyle}
            value={status}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="capability-milestone" style={fieldLabelStyle}>
            Marco (opcional)
          </label>
          <input
            id="capability-milestone"
            onChange={(e) => setMilestone(e.target.value)}
            placeholder="Ex.: Marco Q2"
            style={inputStyle}
            value={milestone}
          />
        </div>

        <EntityLinkField
          kind="solutionTrain"
          label="Solution Train (opcional)"
          onChange={setSolutionTrain}
          value={solutionTrain}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar capability
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function CapabilityList({
  capabilities,
}: {
  capabilities: SolutionTrainCapabilityView[];
}) {
  if (capabilities.length === 0) {
    return (
      <div
        style={{
          marginTop: 12,
          padding: "10px 0 2px",
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        Nenhuma capability cadastrada neste solution train.
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {capabilities.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.title}
            </div>
            {c.milestone && (
              <div style={{ fontSize: 11, color: "var(--ink-subtle)" }}>
                {c.milestone}
              </div>
            )}
          </div>
          <Badge tone={CAPABILITY_STATUS_TONE[c.status] ?? "neutral"}>
            {capabilityStatusLabel(c.status)}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function SolutionTrainBody() {
  const modal = useModal();
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    data: trains,
    loading,
    error,
  } = useAction(listSolutionTrains, [refreshKey]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={
          <Badge tone="accent">{trains?.length ?? 0} solution trains</Badge>
        }
        subtitle="Rollup multi-ART por Solution Train."
        title="Large Solution"
      >
        <Button
          icon="plus"
          onClick={() =>
            modal.open(
              <NewCapabilityModal
                onCreated={() => setRefreshKey((k) => k + 1)}
              />
            )
          }
          size="md"
          variant="primary"
        >
          Adicionar capability
        </Button>
      </PageHeader>
      {error && <ErrorState />}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {!(loading || error) && trains?.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhum solution train cadastrado.
          </span>
        )}
        {trains?.map((t) => (
          <SectionCard
            key={t.id}
            subtitle={t.description ?? undefined}
            title={t.name}
            tone="accent"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
              }}
            >
              <KpiCard
                icon="grid"
                label="ARTs"
                tone="blue"
                value={t.artCount}
              />
              <KpiCard
                icon="layers"
                label="Épicos"
                tone="purple"
                value={t.epicCount}
              />
              <KpiCard
                icon="target"
                label="Capabilities"
                tone="green"
                value={t.capabilityCount}
              />
            </div>
            <CapabilityList capabilities={t.capabilities} />
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

export default function SolutionTrainScreen() {
  return (
    <ModalProvider>
      <SolutionTrainBody />
    </ModalProvider>
  );
}
