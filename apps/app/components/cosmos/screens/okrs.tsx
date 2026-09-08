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
import {
  ModalCard,
  ModalProvider,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import { DirtyProvider, FormField, TextArea, TextInput } from "../modal-form";
import { useActionToast } from "../use-action-toast";

type KeyResultView = OkrView["keyResults"][number];

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
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
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  // O check-in grava `current`, e o progresso do KR é derivado dele — mostrar
  // a porcentagem que vai resultar é o que separa "digitei 12" de "isso leva
  // o KR a 60% do alvo".
  const novoPct =
    valid && kr.target !== 0 ? Math.round((parsed / kr.target) * 100) : null;
  const st = krStatus(novoPct ?? 0);

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

  useModalSubmitShortcut(submit, !saving);

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
              <ModalShortcutHint />
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
                  onClick={submit}
                  size="sm"
                  variant="primary"
                >
                  {saving ? "Salvando..." : "Salvar check-in"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="gauge" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle={kr.title}
        title="Atualizar progresso"
        tone={st.tone}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${st.tone}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div style={previewLabelStyle}>Key Result</div>
              <div
                className="display"
                style={{
                  color: "var(--ink)",
                  fontSize: 14.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 14,
                }}
              >
                {kr.title}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr 1fr",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={previewLabelStyle}>Atual</div>
                  <div
                    className="mono"
                    style={{ color: "var(--ink-muted)", fontSize: 18 }}
                  >
                    {kr.current}
                    {kr.unit}
                  </div>
                </div>
                <div>
                  <div style={previewLabelStyle}>Novo valor</div>
                  <div
                    className="mono"
                    style={{
                      color: valid ? `var(--${st.tone}-text)` : "var(--ink)",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {valid ? parsed : "—"}
                    {kr.unit}
                  </div>
                </div>
              </div>

              {novoPct === null ? (
                <div
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: 11.5,
                    marginBottom: 12,
                  }}
                >
                  Sem progresso calculável ainda
                </div>
              ) : (
                <div style={{ marginBottom: 12 }}>
                  <Progress
                    height={7}
                    tone={st.tone}
                    value={Math.min(100, Math.max(0, novoPct))}
                  />
                  <div
                    className="mono"
                    style={{
                      color: "var(--ink-faint)",
                      fontSize: 10.5,
                      marginTop: 4,
                    }}
                  >
                    {`${novoPct}% do alvo de ${kr.target}${kr.unit}`}
                  </div>
                </div>
              )}

              <Badge dot tone={st.tone}>
                {st.label}
              </Badge>
            </div>
          }
        >
          <FormField
            hint={`Alvo: ${kr.target}${kr.unit} · atual ${kr.current}${kr.unit}`}
            label={`Novo valor (${kr.unit})`}
            required
          >
            <TextInput
              onChange={setValue}
              required
              type="number"
              value={value}
            />
          </FormField>
          <FormField label="Nota (opcional)">
            <TextArea
              maxLength={500}
              onChange={setNote}
              placeholder="Contexto do check-in"
              rows={3}
              value={note}
            />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
