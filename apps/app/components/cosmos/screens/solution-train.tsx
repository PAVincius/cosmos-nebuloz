"use client";

// solution-train.tsx — Solution Train, wired to listSolutionTrains() +
// createCapability(). Per-ART progress (epic/feature completion), the
// consolidated ROAM rollup (SolutionRisk) and cross-ART dependency links
// (CrossArtDependency) are wired to real, tenant-scoped data. The handoff's
// multi-PI cadence timeline is NOT wired — see the comment on
// listSolutionTrains in actions/solution-train.ts for why.
import type { CSSProperties } from "react";
import { useState } from "react";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import {
  createCapability,
  listSolutionTrains,
  type SolutionTrainArtView,
  type SolutionTrainCapabilityView,
  type SolutionTrainCrossArtDependencyView,
  type SolutionTrainRoamView,
} from "@/app/(cosmos)/actions/solution-train";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
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
    if (res.ok) {
      close();
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

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 8,
};

const subsectionStyle: CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: "1px solid var(--hairline)",
};

const ROAM_ORDER = ["RESOLVED", "OWNED", "ACCEPTED", "MITIGATED"] as const;

const ROAM_TONE: Record<(typeof ROAM_ORDER)[number], Tone> = {
  RESOLVED: "green",
  OWNED: "blue",
  ACCEPTED: "amber",
  MITIGATED: "purple",
};

const ROAM_LABEL: Record<(typeof ROAM_ORDER)[number], string> = {
  RESOLVED: "Resolvido",
  OWNED: "Atribuído",
  ACCEPTED: "Aceito",
  MITIGATED: "Mitigado",
};

const CROSS_ART_TYPE_LABEL: Record<
  SolutionTrainCrossArtDependencyView["type"],
  string
> = {
  PROVIDES: "Fornece",
  NEEDS: "Precisa",
  BLOCKS: "Bloqueia",
};

function ArtProgressList({ arts }: { arts: SolutionTrainArtView[] }) {
  if (arts.length === 0) {
    return null;
  }
  return (
    <div style={subsectionStyle}>
      <div style={sectionLabelStyle}>Progresso por ART</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {arts.map((a) => {
          const pct =
            a.featureCount > 0
              ? Math.round((a.doneFeatureCount / a.featureCount) * 100)
              : a.epicCount > 0
                ? Math.round((a.epicDoneCount / a.epicCount) * 100)
                : 0;
          return (
            <div key={a.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {a.name}
                </span>
                <span
                  className="mono"
                  style={{ fontWeight: 700, color: "var(--ink-muted)" }}
                >
                  {pct}%
                </span>
              </div>
              <Progress height={5} tone="blue" value={pct} />
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  marginTop: 4,
                }}
              >
                {a.epicDoneCount}/{a.epicCount} épicos · {a.doneFeatureCount}/
                {a.featureCount} features
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoamRollup({ roam }: { roam: SolutionTrainRoamView }) {
  return (
    <div style={subsectionStyle}>
      <div style={sectionLabelStyle}>ROAM consolidado</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {ROAM_ORDER.map((status) => (
          <div
            key={status}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 4px",
              borderRadius: "var(--r-md)",
              background: `var(--${ROAM_TONE[status]}-soft)`,
              border: `1px solid rgba(var(--${ROAM_TONE[status]}-rgb),.25)`,
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: `var(--${ROAM_TONE[status]}-text)`,
              }}
            >
              {roam.counts[status]}
            </div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: "var(--ink-subtle)",
              }}
            >
              {ROAM_LABEL[status]}
            </div>
          </div>
        ))}
      </div>
      {roam.risks.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          Nenhum risco de solução registrado.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {roam.risks.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.title}
              </span>
              {r.owner && (
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  {r.owner}
                </span>
              )}
              <Badge tone={ROAM_TONE[r.roamStatus]}>
                {ROAM_LABEL[r.roamStatus]}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrossArtDependencyList({
  deps,
}: {
  deps: SolutionTrainCrossArtDependencyView[];
}) {
  return (
    <div style={subsectionStyle}>
      <div style={sectionLabelStyle}>Dependências cross-ART</div>
      {deps.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          Nenhuma dependência cross-ART registrada.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {deps.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--ink-muted)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {d.sourceArtName}
              </span>
              <Icon name="arrowRight" size={12} />
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {d.targetArtName}
              </span>
              <Badge tone="neutral">{CROSS_ART_TYPE_LABEL[d.type]}</Badge>
            </div>
          ))}
        </div>
      )}
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
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
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
            <ArtProgressList arts={t.arts} />
            <RoamRollup roam={t.roam} />
            <CrossArtDependencyList deps={t.crossArtDependencies} />
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
