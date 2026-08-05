"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  IconButton,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useNav,
} from "@repo/design-system/cosmos/kit";
// objective-detail-client.tsx — ObjectiveDetailScreen (design handoff
// screen-bundle-3.jsx:461-704), driving the existing OKR/KeyResult actions
// in app/actions/okrs. Inline edit of the objective (title/description/
// owner/status), add/remove/edit Key Results, and a per-KR "why" note (see
// objective-detail.ts for why that reuses KeyResultSnapshot.note instead of
// a new column).
//
// AI-assisted "update progress" (RF-41): the handoff's UpdateProgressModal
// cross-references KR values against linked epic/feature progress to
// suggest new numbers. That signal-gathering + prompt design is real new
// work, not a thin UI wrapper like the rest of this screen, so it is
// deliberately deferred rather than faked here — the manual editing below
// (title/current/target/unit, plus the why note) is the full real feature.
import { useState } from "react";
import type { ObjectiveDetailFull } from "@/app/(cosmos)/actions/objective-detail";
import {
  createKeyResult,
  createKeyResultCheckIn,
  deleteKeyResult,
  updateKeyResult,
  updateOKR,
} from "@/app/actions/okrs";
import { useActionToast } from "../use-action-toast";

type OwnerOption = { id: string; name: string };
type KeyResultView = ObjectiveDetailFull["keyResults"][number];

const STATUS_OPTIONS = ["ON_TRACK", "AT_RISK", "BEHIND", "ACHIEVED"] as const;
const STATUS_TONE: Record<string, Tone> = {
  ON_TRACK: "green",
  AT_RISK: "amber",
  BEHIND: "red",
  ACHIEVED: "blue",
};
const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "On track",
  AT_RISK: "Em risco",
  BEHIND: "Atrasado",
  ACHIEVED: "Atingido",
};

function krTone(pct: number): Tone {
  if (pct >= 70) {
    return "green";
  }
  if (pct >= 40) {
    return "amber";
  }
  return "red";
}

function whyPlaceholder(tone: Tone): string {
  if (tone === "green") {
    return "Por que está on track: o que está funcionando bem?";
  }
  if (tone === "amber") {
    return "Por que está em risco: o que está travando o avanço?";
  }
  return "Por que está crítico: qual é o bloqueio principal?";
}

const fieldLabelStyle = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase" as const,
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const inputStyle = {
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

function KrRow({
  kr,
  canRemove,
  onChanged,
  onRemoved,
}: {
  kr: KeyResultView;
  canRemove: boolean;
  onChanged: (next: KeyResultView) => void;
  onRemoved: () => void;
}) {
  const tone = krTone(kr.progressPct);
  const [editingFields, setEditingFields] = useState(false);
  const [title, setTitle] = useState(kr.title);
  const [current, setCurrent] = useState(String(kr.current));
  const [target, setTarget] = useState(String(kr.target));
  const [unit, setUnit] = useState(kr.unit);
  const [editingWhy, setEditingWhy] = useState(false);
  const [why, setWhy] = useState(kr.whyNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveFields() {
    const currentNum = Number(current);
    const targetNum = Number(target);
    if (
      saving ||
      !title.trim() ||
      !Number.isFinite(currentNum) ||
      !Number.isFinite(targetNum) ||
      targetNum <= 0
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateKeyResult(kr.id, {
      title: title.trim(),
      current: currentNum,
      target: targetNum,
      unit: unit.trim() || "%",
    });
    setSaving(false);
    if (res.ok) {
      onChanged({
        ...kr,
        title: res.data.title,
        current: res.data.current,
        target: res.data.target,
        unit: res.data.unit,
        progressPct: res.data.progress,
      });
      setEditingFields(false);
    } else {
      setError(res.error);
    }
  }

  async function removeKr() {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    const res = await deleteKeyResult(kr.id);
    setSaving(false);
    if (res.ok) {
      onRemoved();
    } else {
      setError(res.error);
    }
  }

  async function saveWhy() {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createKeyResultCheckIn({
      keyResultId: kr.id,
      value: kr.current,
      note: why.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      onChanged({ ...kr, whyNote: res.data.note });
      setEditingWhy(false);
    } else {
      setError(res.error);
    }
  }

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      {error && <ErrorState message={error} />}
      {editingFields ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <label htmlFor={`kr-title-${kr.id}`} style={fieldLabelStyle}>
            Key Result
          </label>
          <input
            id={`kr-title-${kr.id}`}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
            value={title}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <label htmlFor={`kr-current-${kr.id}`} style={fieldLabelStyle}>
                Atual
              </label>
              <input
                id={`kr-current-${kr.id}`}
                onChange={(e) => setCurrent(e.target.value)}
                style={inputStyle}
                type="number"
                value={current}
              />
            </div>
            <div>
              <label htmlFor={`kr-target-${kr.id}`} style={fieldLabelStyle}>
                Meta
              </label>
              <input
                id={`kr-target-${kr.id}`}
                onChange={(e) => setTarget(e.target.value)}
                style={inputStyle}
                type="number"
                value={target}
              />
            </div>
            <div>
              <label htmlFor={`kr-unit-${kr.id}`} style={fieldLabelStyle}>
                Unidade
              </label>
              <input
                id={`kr-unit-${kr.id}`}
                onChange={(e) => setUnit(e.target.value)}
                style={inputStyle}
                value={unit}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            {canRemove ? (
              <Button onClick={removeKr} size="sm" variant="secondary">
                Remover KR
              </Button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                onClick={() => setEditingFields(false)}
                size="sm"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button
                icon="check"
                onClick={saveFields}
                size="sm"
                variant="primary"
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--ink-faint)",
              letterSpacing: ".06em",
            }}
          >
            KR
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--ink)",
              textWrap: "pretty",
            }}
          >
            {kr.title}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-subtle)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: `var(--${tone}-text)`, fontWeight: 700 }}>
              {kr.current}
              {kr.unit}
            </span>{" "}
            / {kr.target}
            {kr.unit}
          </span>
          <Badge dot tone={tone}>
            {tone === "green"
              ? "On track"
              : tone === "amber"
                ? "Em risco"
                : "Atrasado"}
          </Badge>
          <IconButton
            name="sliders"
            onClick={() => setEditingFields(true)}
            size={24}
            title="Editar KR"
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <Progress height={7} tone={tone} value={kr.progressPct} />
        </div>
        <span
          className="mono"
          style={{
            width: 44,
            textAlign: "right",
            fontSize: 12.5,
            fontWeight: 700,
            color: `var(--${tone}-text)`,
          }}
        >
          {kr.progressPct}%
        </span>
      </div>

      {editingWhy ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            onChange={(e) => setWhy(e.target.value)}
            placeholder={whyPlaceholder(tone)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
            value={why}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button
              onClick={() => {
                setWhy(kr.whyNote ?? "");
                setEditingWhy(false);
              }}
              size="sm"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button icon="check" onClick={saveWhy} size="sm" variant="primary">
              Salvar explicação
            </Button>
          </div>
        </div>
      ) : kr.whyNote ? (
        <button
          className="chart-hit"
          onClick={() => setEditingWhy(true)}
          style={{
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
            padding: "9px 11px",
            borderRadius: "var(--r-sm)",
            border: "none",
            background: "var(--surface-2)",
            fontSize: 12,
            fontFamily: "inherit",
            color: "var(--ink-muted)",
            lineHeight: 1.5,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
          type="button"
        >
          <Icon
            name="fileText"
            size={13}
            style={{
              color: `var(--${tone}-text)`,
              marginTop: 1,
              flexShrink: 0,
            }}
          />
          <span>{kr.whyNote}</span>
        </button>
      ) : (
        <button
          onClick={() => setEditingWhy(true)}
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: `var(--${tone}-text)`,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            gap: 5,
            alignItems: "center",
          }}
          type="button"
        >
          <Icon name="plus" size={11} strokeWidth={2.4} />
          {whyPlaceholder(tone)}
        </button>
      )}
    </div>
  );
}

export default function ObjectiveDetailClient({
  objectiveId,
  initial,
  owners,
}: {
  objectiveId: string;
  initial: ObjectiveDetailFull;
  owners: OwnerOption[];
}) {
  const { navigate } = useNav();
  const [data, setData] = useState(initial);
  const [editingObjective, setEditingObjective] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [ownerId, setOwnerId] = useState(initial.ownerId ?? "");
  const [status, setStatus] = useState(initial.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingKr, setAddingKr] = useState(false);

  const tone = STATUS_TONE[data.status] ?? "neutral";
  const avg = data.keyResults.length
    ? Math.round(
        data.keyResults.reduce((s, k) => s + k.progressPct, 0) /
          data.keyResults.length
      )
    : 0;

  async function saveObjective() {
    if (saving || !title.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateOKR(objectiveId, {
      title: title.trim(),
      description: description.trim() || undefined,
      ownerId: ownerId || undefined,
      status,
    });
    setSaving(false);
    if (res.ok) {
      const ownerName = owners.find((o) => o.id === ownerId)?.name ?? null;
      setData((d) => ({
        ...d,
        title: res.data.title,
        description: res.data.description,
        status: res.data.status,
        ownerId: res.data.ownerId,
        ownerName: res.data.ownerId ? ownerName : null,
      }));
      setEditingObjective(false);
    } else {
      setError(res.error);
    }
  }

  async function addKeyResult() {
    if (addingKr) {
      return;
    }
    setAddingKr(true);
    setError(null);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createKeyResult({
          okrId: objectiveId,
          title: "Novo Key Result",
          current: 0,
          target: 100,
          unit: "%",
        }),
      {
        loading: "Adicionando Key Result...",
        success: "Key Result adicionado.",
        error: (err: string) => `Não foi possível adicionar: ${err}`,
      }
    );
    setAddingKr(false);
    if (res.ok) {
      setData((d) => ({
        ...d,
        keyResults: [
          ...d.keyResults,
          {
            id: res.data.id,
            title: res.data.title,
            current: res.data.current,
            target: res.data.target,
            unit: res.data.unit,
            progressPct: res.data.progress,
            whyNote: null,
          },
        ],
      }));
    }
  }

  return (
    <div className="fade-in">
      <button
        className="btn"
        onClick={() => navigate("okrs")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--ink-muted)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 14,
          padding: 0,
        }}
        type="button"
      >
        ← OKRs
      </button>

      <PageHeader
        eyebrow="Objetivo · Portfolio"
        meta={
          <>
            <Badge tone="neutral">{data.id}</Badge>
            <Badge dot tone={tone}>
              {STATUS_LABEL[data.status] ?? data.status}
            </Badge>
          </>
        }
        subtitle={
          data.ownerName ? `Dono: ${data.ownerName}` : "Sem dono definido"
        }
        title={data.title}
        tone={tone}
      >
        <Button
          icon="sliders"
          onClick={() => {
            setTitle(data.title);
            setDescription(data.description ?? "");
            setOwnerId(data.ownerId ?? "");
            setStatus(data.status);
            setEditingObjective((v) => !v);
          }}
          size="md"
          variant="secondary"
        >
          {editingObjective ? "Cancelar edição" : "Editar objetivo"}
        </Button>
      </PageHeader>

      {error && <ErrorState message={error} />}

      {editingObjective && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 18,
            marginBottom: 20,
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
          }}
        >
          <div>
            <label htmlFor="obj-title" style={fieldLabelStyle}>
              Objetivo
            </label>
            <textarea
              id="obj-title"
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
              value={title}
            />
          </div>
          <div>
            <label htmlFor="obj-description" style={fieldLabelStyle}>
              Descrição (opcional)
            </label>
            <textarea
              id="obj-description"
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
              value={description}
            />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label htmlFor="obj-owner" style={fieldLabelStyle}>
                Dono
              </label>
              <select
                id="obj-owner"
                onChange={(e) => setOwnerId(e.target.value)}
                style={inputStyle}
                value={ownerId}
              >
                <option value="">— sem dono —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="obj-status" style={fieldLabelStyle}>
                Status
              </label>
              <select
                id="obj-status"
                onChange={(e) => setStatus(e.target.value)}
                style={inputStyle}
                value={status}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button icon="check" onClick={saveObjective} size="md">
              Salvar
            </Button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          hint={`${data.keyResults.length} Key Results`}
          icon="gauge"
          label="Progresso médio"
          tone={tone}
          unit="%"
          value={avg}
        />
        <KpiCard
          hint={`de ${data.keyResults.length}`}
          icon="check"
          label="On track"
          tone="green"
          value={data.keyResults.filter((k) => k.progressPct >= 70).length}
        />
        <KpiCard
          hint={`de ${data.keyResults.length}`}
          icon="alert"
          label="Em risco / atrasado"
          tone="red"
          value={data.keyResults.filter((k) => k.progressPct < 70).length}
        />
      </div>

      <SectionCard
        action={
          <Button
            icon="plus"
            onClick={addKeyResult}
            size="sm"
            variant="secondary"
          >
            Novo KR
          </Button>
        }
        icon="target"
        subtitle="Edite texto, valores e o motivo do status atual — histórico registrado como check-in"
        title="Key Results"
        tone={tone}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.keyResults.map((kr) => (
            <KrRow
              canRemove={data.keyResults.length > 1}
              key={kr.id}
              kr={kr}
              onChanged={(next) =>
                setData((d) => ({
                  ...d,
                  keyResults: d.keyResults.map((k) =>
                    k.id === next.id ? next : k
                  ),
                }))
              }
              onRemoved={() =>
                setData((d) => ({
                  ...d,
                  keyResults: d.keyResults.filter((k) => k.id !== kr.id),
                }))
              }
            />
          ))}
          {data.keyResults.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum Key Result ainda.
            </span>
          )}
        </div>
      </SectionCard>

      <p
        style={{
          marginTop: 14,
          fontSize: 11.5,
          color: "var(--ink-faint)",
          lineHeight: 1.5,
        }}
      >
        Sugestão automática de progresso via IA (comparando KRs com o avanço de
        épicos/features vinculados) ainda não está implementada nesta tela — a
        atualização acima é manual.
      </p>
    </div>
  );
}
