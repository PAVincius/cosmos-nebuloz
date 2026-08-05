"use client";

// okrs.tsx — OKRs do portfólio (objetivos + key results), wired to listOkrs().
// UpdateProgressModal reuses the existing createKeyResultCheckIn action
// (story check-in flow) to register a KR progress update from this screen.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  KpiCard,
  PageHeader,
  Progress,
  useNav,
} from "@repo/design-system/cosmos/kit";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { listOkrs, type OkrView } from "@/app/(cosmos)/actions/okrs";
import { createKeyResultCheckIn } from "@/app/actions/okrs";
import type { Tone } from "@/lib/cosmos-data";
import { CardHeaderGlow, IconBadge } from "../card-header-glow";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

type KeyResultView = OkrView["keyResults"][number];

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

// UpdateProgressModal — manual KR check-in form. AI cross-referencing
// against epic/feature progress (mentioned in the handoff) is a deferred
// enhancement; this is the manual-entry path only.
function UpdateProgressModal({
  kr,
  onUpdated,
}: {
  kr: KeyResultView;
  onUpdated?: () => void;
}) {
  const { close } = useModal();
  const [value, setValue] = useState(String(kr.current));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  const submit = async () => {
    if (!(valid && !saving)) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createKeyResultCheckIn({
          keyResultId: kr.id,
          note: note.trim() || undefined,
          value: parsed,
        }),
      {
        error: (err: string) =>
          `Não foi possível atualizar o progresso: ${err}`,
        loading: "Registrando check-in...",
        success: "Progresso atualizado.",
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onUpdated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="gauge" size={16} strokeWidth={2.4} />}
      subtitle={kr.title}
      title="Atualizar progresso"
      width={420}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="kr-checkin-value" style={fieldLabelStyle}>
            Novo valor ({kr.unit}) — alvo {kr.target}
            {kr.unit}
          </label>
          <input
            id="kr-checkin-value"
            min={0}
            onChange={(e) => setValue(e.target.value)}
            style={inputStyle}
            type="number"
            value={value}
          />
        </div>
        <div>
          <label htmlFor="kr-checkin-note" style={fieldLabelStyle}>
            Nota (opcional)
          </label>
          <textarea
            id="kr-checkin-note"
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contexto do check-in…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            value={note}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={submit} size="sm" variant="primary">
            Salvar check-in
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  ON_TRACK: "green",
  AT_RISK: "amber",
  BEHIND: "red",
  ACHIEVED: "blue",
};

function krStatus(v: number): { tone: Tone; label: string } {
  if (v >= 70) {
    return { tone: "green", label: "On track" };
  }
  if (v >= 40) {
    return { tone: "amber", label: "Em risco" };
  }
  return { tone: "red", label: "Atrasado" };
}

function ObjectiveCard({
  o,
  onUpdated,
}: {
  o: OkrView;
  onUpdated: () => void;
}) {
  const modal = useModal();
  const { navigate } = useNav();
  const tone = STATUS_TONE[o.status] ?? "neutral";
  const avg = o.keyResults.length
    ? Math.round(
        o.keyResults.reduce((s, k) => s + k.progressPct, 0) /
          o.keyResults.length
      )
    : 0;
  const st = krStatus(avg);
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        overflow: "hidden",
      }}
    >
      <CardHeaderGlow onActivate={() => navigate("okr", o.id)} tone={tone}>
        <IconBadge tone={tone}>
          <Icon name="star" size={20} strokeWidth={1.8} />
        </IconBadge>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-subtle)",
                fontWeight: 700,
              }}
            >
              {o.id}
            </span>
          </div>
          <div
            className="display"
            style={{
              fontSize: 16.5,
              fontWeight: 700,
              letterSpacing: "-.015em",
              color: "var(--ink)",
              lineHeight: 1.3,
              textWrap: "pretty",
            }}
          >
            {o.title}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--ink-subtle)",
            }}
          >
            <Avatar name={o.ownerName} size={20} tone={tone} />
            <span style={{ fontWeight: 500 }}>{o.ownerName}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            className="mono"
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-.03em",
              color: `var(--${st.tone}-text)`,
              lineHeight: 1,
            }}
          >
            {avg}%
          </div>
          <div style={{ marginTop: 5 }}>
            <Badge dot tone={st.tone}>
              {st.label}
            </Badge>
          </div>
        </div>
      </CardHeaderGlow>
      <div style={{ padding: "8px 20px 16px" }}>
        {o.keyResults.map((k, i) => {
          const ks = krStatus(k.progressPct);
          return (
            <div
              key={k.id}
              style={{
                padding: "12px 0",
                borderBottom:
                  i < o.keyResults.length - 1
                    ? "1px solid var(--hairline)"
                    : "none",
              }}
            >
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
                  KR{i + 1}
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
                  {k.title}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--ink-subtle)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{ color: `var(--${ks.tone}-text)`, fontWeight: 700 }}
                  >
                    {k.current}
                    {k.unit}
                  </span>{" "}
                  / {k.target}
                  {k.unit}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Progress height={7} tone={ks.tone} value={k.progressPct} />
                </div>
                <span
                  className="mono"
                  style={{
                    width: 44,
                    textAlign: "right",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: `var(--${ks.tone}-text)`,
                  }}
                >
                  {k.progressPct}%
                </span>
                <IconButton
                  name="gauge"
                  onClick={() =>
                    modal.open(
                      <UpdateProgressModal kr={k} onUpdated={onUpdated} />
                    )
                  }
                  size={26}
                  title="Atualizar progresso"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OkrsBody() {
  const [okrs, setOkrs] = useState<OkrView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listOkrs().then((r) => {
      if (r.ok) {
        setOkrs(r.data);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allKrs = okrs.flatMap((o) => o.keyResults);
  const avgAll = allKrs.length
    ? Math.round(allKrs.reduce((s, k) => s + k.progressPct, 0) / allKrs.length)
    : 0;
  const onTrack = allKrs.filter((k) => k.progressPct >= 70).length;
  const atRisk = allKrs.filter((k) => k.progressPct < 40).length;
  const withOwner = okrs.filter((o) => o.ownerName !== "—").length;
  return (
    <div className="fade-in">
      <PageHeader
        meta={
          <>
            <Badge icon="star" tone="accent">
              {okrs.length} objetivos
            </Badge>
            <Badge tone="neutral">{allKrs.length} key results</Badge>
            <Badge dot tone="green">
              Check-in semanal
            </Badge>
          </>
        }
        subtitle="Objetivos e Key Results do portfólio. Conectam a estratégia às entregas dos ARTs e times."
        title="OKRs"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          hint="média dos key results"
          icon="gauge"
          label="Progresso médio dos OKRs"
          tone="accent"
          unit="%"
          value={avgAll}
        />
        <KpiCard
          hint={`de ${allKrs.length} no total`}
          icon="check"
          label="Key Results on track"
          tone="green"
          value={onTrack}
        />
        <KpiCard
          hint="< 40% do alvo"
          icon="alert"
          label="Key Results em risco"
          tone="red"
          value={atRisk}
        />
        <KpiCard
          hint={`de ${okrs.length} objetivos`}
          icon="target"
          label="Objetivos com dono"
          tone="purple"
          value={withOwner}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--gap)",
        }}
      >
        {!loading && okrs.length === 0 && (
          <KpiCard
            hint="Crie um OKR de portfólio"
            icon="target"
            label="Nenhum OKR"
            tone="accent"
            value="—"
          />
        )}
        {okrs.map((o) => (
          <ObjectiveCard key={o.id} o={o} onUpdated={load} />
        ))}
      </div>
    </div>
  );
}

export default function OkrsScreen() {
  return (
    <ModalProvider>
      <OkrsBody />
    </ModalProvider>
  );
}
