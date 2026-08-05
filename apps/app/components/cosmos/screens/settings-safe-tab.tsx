"use client";

import {
  Badge,
  Button,
  ErrorState,
  SectionCard,
  Skel,
  useAction,
} from "@repo/design-system/cosmos/kit";
// settings-safe-tab.tsx — Configuração SAFe tab (Settings screen, tab 6).
// Per-ART cadence (piCadenceWeeks/sprintLengthWeeks) via
// saveArtCadenceAction (= arts/lifecycle.ts::updateARTCadence, ADMIN|RTE
// gated, blocks while a PI Plan is COMMITTED/EXECUTING — surfaced as a
// toast error, not swallowed) and the tenant-wide WsjfSettings row via the
// new settings/wsjf-settings.ts (ADMIN gated). Both real, both editable
// only for the roles the server actually allows; every other role sees the
// same values read-only.
import { useEffect, useState } from "react";
import {
  type ArtCadenceView,
  getSafeConfigTab,
  saveArtCadenceAction,
  saveWsjfSettingsAction,
} from "@/app/(cosmos)/actions/settings-safe";
import { useActionToast } from "../use-action-toast";
import { fieldLabelStyle, inputStyle, selectStyle } from "./settings-shared";

const CADENCE_ROLES = new Set(["ADMIN", "RTE"]);

function ArtCadenceRow({
  art,
  canEdit,
  onSaved,
}: {
  art: ArtCadenceView;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [piWeeks, setPiWeeks] = useState(art.piCadenceWeeks);
  const [sprintWeeks, setSprintWeeks] = useState(art.sprintLengthWeeks);
  const [saving, setSaving] = useState(false);

  const dirty =
    piWeeks !== art.piCadenceWeeks || sprintWeeks !== art.sprintLengthWeeks;

  const save = async () => {
    if (!dirty || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        saveArtCadenceAction({
          artId: art.id,
          piCadenceWeeks: piWeeks,
          sprintLengthWeeks: sprintWeeks,
        }),
      {
        loading: `Salvando cadência de ${art.name}...`,
        success: "Cadência atualizada.",
        error: (err: string) =>
          err.includes("ACTIVE_PI_PLAN")
            ? "Não é possível alterar a cadência com um PI Plan ativo (COMMITTED/EXECUTING)."
            : `Não foi possível salvar: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      onSaved();
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.3fr) 120px 120px 90px 90px",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
          {art.name}
        </div>
        <Badge tone={art.status === "ACTIVE" ? "green" : "neutral"}>
          {art.status}
        </Badge>
      </div>
      <div>
        <label style={fieldLabelStyle}>PI (semanas)</label>
        {canEdit ? (
          <input
            max={52}
            min={2}
            onChange={(e) => setPiWeeks(Number(e.target.value))}
            style={inputStyle}
            type="number"
            value={piWeeks}
          />
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink)" }}>{piWeeks}</div>
        )}
      </div>
      <div>
        <label style={fieldLabelStyle}>Sprint (semanas)</label>
        {canEdit ? (
          <input
            max={4}
            min={1}
            onChange={(e) => setSprintWeeks(Number(e.target.value))}
            style={inputStyle}
            type="number"
            value={sprintWeeks}
          />
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink)" }}>{sprintWeeks}</div>
        )}
      </div>
      <Badge tone={art.ipSprintEnabled ? "accent" : "neutral"}>
        {art.ipSprintEnabled ? "IP on" : "IP off"}
      </Badge>
      {canEdit && (
        <Button
          onClick={save}
          size="sm"
          style={
            dirty && !saving ? undefined : { opacity: 0.5, cursor: "default" }
          }
          variant="secondary"
        >
          Salvar
        </Button>
      )}
    </div>
  );
}

const SCALE_OPTIONS = ["fibonacci", "linear"];
const AUTO_RECALC_OPTIONS = ["realtime", "daily", "weekly", "manual"];
const APPROVER_OPTIONS = ["rte", "lpm", "po", "any"];

function WsjfSettingsCard({
  wsjf,
  canEdit,
  onSaved,
}: {
  wsjf: {
    weightBv: number;
    weightTc: number;
    weightRr: number;
    scale: string;
    autoRecalc: string;
    rebalanceApprover: string;
    staleDays: number;
  };
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(wsjf);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(wsjf);
  }, [wsjf]);

  const dirty = JSON.stringify(form) !== JSON.stringify(wsjf);

  const save = async () => {
    if (!dirty || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => saveWsjfSettingsAction(form), {
      loading: "Salvando configuração WSJF...",
      success: "Configuração WSJF atualizada.",
      error: (err: string) => `Não foi possível salvar: ${err}`,
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
      }}
    >
      {(
        [
          ["weightBv", "Peso Business Value"],
          ["weightTc", "Peso Time Criticality"],
          ["weightRr", "Peso Risk Reduction"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label style={fieldLabelStyle}>{label}</label>
          {canEdit ? (
            <input
              max={10}
              min={0.1}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
              }
              step={0.1}
              style={inputStyle}
              type="number"
              value={form[key]}
            />
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink)" }}>{form[key]}</div>
          )}
        </div>
      ))}
      <div>
        <label style={fieldLabelStyle}>Escala</label>
        {canEdit ? (
          <select
            onChange={(e) => setForm((f) => ({ ...f, scale: e.target.value }))}
            style={selectStyle}
            value={form.scale}
          >
            {SCALE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink)" }}>{form.scale}</div>
        )}
      </div>
      <div>
        <label style={fieldLabelStyle}>Recálculo automático</label>
        {canEdit ? (
          <select
            onChange={(e) =>
              setForm((f) => ({ ...f, autoRecalc: e.target.value }))
            }
            style={selectStyle}
            value={form.autoRecalc}
          >
            {AUTO_RECALC_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink)" }}>
            {form.autoRecalc}
          </div>
        )}
      </div>
      <div>
        <label style={fieldLabelStyle}>Aprovador de rebalanceamento</label>
        {canEdit ? (
          <select
            onChange={(e) =>
              setForm((f) => ({ ...f, rebalanceApprover: e.target.value }))
            }
            style={selectStyle}
            value={form.rebalanceApprover}
          >
            {APPROVER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink)" }}>
            {form.rebalanceApprover}
          </div>
        )}
      </div>
      <div>
        <label style={fieldLabelStyle}>Dias até obsoleto</label>
        {canEdit ? (
          <input
            max={90}
            min={1}
            onChange={(e) =>
              setForm((f) => ({ ...f, staleDays: Number(e.target.value) }))
            }
            style={inputStyle}
            type="number"
            value={form.staleDays}
          />
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink)" }}>
            {form.staleDays}
          </div>
        )}
      </div>
      {canEdit && (
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            onClick={save}
            size="sm"
            style={
              dirty && !saving ? undefined : { opacity: 0.5, cursor: "default" }
            }
            variant="primary"
          >
            Salvar configuração WSJF
          </Button>
        </div>
      )}
    </div>
  );
}

const DEFAULT_WSJF = {
  weightBv: 1,
  weightTc: 1,
  weightRr: 1,
  scale: "fibonacci",
  autoRecalc: "daily",
  rebalanceApprover: "rte",
  staleDays: 14,
};

export default function SettingsSafeTab() {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAction(getSafeConfigTab, [reloadKey]);
  const reload = () => setReloadKey((k) => k + 1);

  if (error) {
    return <ErrorState />;
  }

  const canEditCadence = !!data && CADENCE_ROLES.has(data.currentUserRole);
  const canEditWsjf = !!data && data.currentUserRole === "ADMIN";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard
        icon="calendar"
        subtitle="ART.piCadenceWeeks / ART.sprintLengthWeeks — bloqueado enquanto houver PI Plan COMMITTED/EXECUTING"
        title="Cadência por ART"
        tone="accent"
      >
        {loading && <Skel h={60} />}
        {!loading && data && data.arts.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhum ART configurado neste workspace.
          </span>
        )}
        {!loading && data && data.arts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.arts.map((art) => (
              <ArtCadenceRow
                art={art}
                canEdit={canEditCadence}
                key={art.id}
                onSaved={reload}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon="sliders"
        subtitle="WsjfSettings — multiplicadores de Cost of Delay usados por scoreWsjfAction"
        title="Configuração WSJF"
        tone="purple"
      >
        {loading && <Skel h={60} />}
        {!loading && data && (
          <WsjfSettingsCard
            canEdit={canEditWsjf}
            onSaved={reload}
            wsjf={data.wsjf ?? DEFAULT_WSJF}
          />
        )}
        {!loading && data && !data.wsjf && (
          <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10 }}>
            Nenhuma configuração salva ainda — valores padrão (1/1/1) exibidos
            acima, iguais aos usados pelo scoring quando não há registro.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
