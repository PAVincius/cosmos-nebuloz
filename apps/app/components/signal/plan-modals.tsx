"use client";

// Modais do plano de medição — SG-DEV-04/05.
//
// O modal da métrica é o lugar onde se lê a definição inteira (fórmula, meta,
// fonte, versão), se age (aprovar, mapear, pausar, pedir revisão) e se confere o
// histórico. Editar NÃO sobrescreve: cada mudança vira uma versão e o antes/
// depois fica no histórico — é o que responde "com qual definição o board viu
// esse número?".

import { Button } from "@repo/design-system/cosmos/kit";
import { useCallback, useId, useState } from "react";
import { editMetric } from "@/app/(signal)/actions/plan-edit";
import {
  approveMetric,
  mapMetricSource,
  pauseMetric,
  resumeMetric,
} from "@/app/(signal)/actions/plan-flow";
import {
  getPlanMetric,
  type PlanMetricHistory,
} from "@/app/(signal)/actions/plan-read";
import {
  changePrimary,
  requestTargetReview,
} from "@/app/(signal)/actions/plan-review";
import { proposeMetric } from "@/app/(signal)/actions/plan-setup";
import { formatMetricValue, PLAN_STATE_META } from "@/lib/signal/plan";
import {
  Eyebrow,
  Field,
  Input,
  ModalShell,
  ScreenError,
  Select,
  SkeletonCard,
  Textarea,
  useModal,
  useSignalData,
} from "./base";

const ACTION_LABEL: Record<string, string> = {
  PROPOSE: "Proposta",
  APPROVE: "Aprovada no plano",
  MAP_SOURCE: "Fonte mapeada",
  START_MEASURING: "Passou a medir",
  PAUSE: "Pausada",
  RESUME: "Retomada",
  FREEZE: "Congelada",
  REQUEST_TARGET_REVIEW: "Revisão de meta pedida",
  CHANGE_PRIMARY: "Primária trocada",
  EDIT: "Editada",
};

const DIRECTION_LABEL = {
  UP: "↑ quanto maior, melhor",
  DOWN: "↓ quanto menor, melhor",
} as const;

type Outcome = { ok: boolean; error?: string; blockers?: string[] };

function Note({
  error,
  blockers,
}: {
  error: string | null;
  blockers?: string[];
}) {
  if (!error) {
    return null;
  }
  return (
    <div
      role="alert"
      style={{
        padding: "10px 12px",
        borderRadius: "var(--r-sm)",
        background: "var(--red-soft)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        color: "var(--red-text)",
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      {error}
      {(blockers?.length ?? 0) > 0 ? (
        <ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>
          {blockers?.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 3 }}>
        {children}
      </div>
    </div>
  );
}

// ── Ações ─────────────────────────────────────────────────────────────────────

type Pending = "pause" | "resume" | "review" | "primary" | null;

const PENDING_COPY: Record<
  Exclude<Pending, null>,
  { title: string; hint: string; cta: string }
> = {
  pause: {
    title: "Pausar a medição",
    hint: "Diga por que pausa. Métrica pausada deixa buraco no veredito, e quem lê precisa saber o motivo.",
    cta: "Pausar",
  },
  resume: {
    title: "Retomar a medição",
    hint: "O que mudou para a medição voltar (fonte reparada, janela reaberta…).",
    cta: "Retomar",
  },
  primary: {
    title: "Trocar a primária por esta métrica",
    hint: "Diga por que a decisão do veredito passa para esta métrica (mínimo de 10 caracteres). A primária de hoje vira guarda e as duas ganham versão nova. Se a de hoje estiver congelada, vira pedido de revisão ao Scaffold.",
    cta: "Trocar primária",
  },
  review: {
    title: "Pedir revisão de meta ao Scaffold",
    hint: "A meta está congelada: baseline e caso de negócio são do Scaffold. O pedido leva este texto ao dono da trilha.",
    cta: "Enviar pedido",
  },
};

function SourcePicker({
  mappings,
  busy,
  denial,
  onMap,
}: {
  mappings: { id: string; label: string; healthy: boolean }[];
  busy: boolean;
  /** Motivo de mapear estar desabilitado; nulo = pode. */
  denial: string | null;
  onMap: (mappingId: string) => void;
}) {
  const id = useId();
  // Abre numa conexão saudável: mapear para uma caída não leva a métrica a
  // Medindo, e o padrão não pode empurrar a pessoa para esse caminho.
  const first = mappings.find((x) => x.healthy) ?? mappings[0];
  const [mappingId, setMappingId] = useState(first?.id ?? "");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}
      >
        <Field htmlFor={`${id}-map`} label="Fonte da métrica">
          <Select
            ariaLabel="Mapeamento de origem"
            id={`${id}-map`}
            onChange={setMappingId}
            options={mappings.map((x) => ({
              value: x.id,
              label: x.healthy ? x.label : `${x.label} — conexão com problema`,
            }))}
            value={mappingId}
          />
        </Field>
        <Button
          disabled={busy || !mappingId || denial !== null}
          icon="plug"
          onClick={() => onMap(mappingId)}
          title={denial ?? undefined}
          variant="ghost"
        >
          Mapear fonte
        </Button>
      </div>
      {denial ? (
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-faint)" }}>
          {denial}
        </p>
      ) : null}
    </div>
  );
}

function CommentBox({
  kind,
  comment,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  kind: Exclude<Pending, null>;
  comment: string;
  busy: boolean;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const min = kind === "primary" ? 10 : 3;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Field
        hint={PENDING_COPY[kind].hint}
        htmlFor={`${id}-comment`}
        label={PENDING_COPY[kind].title}
        required
      >
        <Textarea
          id={`${id}-comment`}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          value={comment}
        />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          disabled={busy || comment.trim().length < min}
          onClick={onConfirm}
        >
          {PENDING_COPY[kind].cta}
        </Button>
        <Button onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ActionsPanel({
  m,
  denial,
  mapDenial,
  mappings,
  done,
}: {
  m: PlanMetricHistory["metric"];
  denial: string | null;
  mapDenial: string | null;
  mappings: { id: string; label: string; healthy: boolean }[];
  done: () => void;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<Outcome>) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      setBusy(false);
      if (res.ok) {
        setPending(null);
        setComment("");
        done();
        return;
      }
      setError(res.error ?? "Não foi possível concluir.");
    },
    [done]
  );

  const confirm = () => {
    const input = { id: m.id, comment };
    if (pending === "pause") {
      return run(() => pauseMetric(input));
    }
    if (pending === "resume") {
      return run(() => resumeMetric(input));
    }
    if (pending === "primary") {
      return run(async () => {
        const res = await changePrimary({ id: m.id, justification: comment });
        if (res.ok && res.data.outcome === "review-requested") {
          setNotice(
            "A primária atual está congelada: em vez de trocar, enviei o pedido de revisão ao Scaffold."
          );
        }
        return res;
      });
    }
    return run(() => requestTargetReview(input));
  };

  const decide = (
    label: string,
    onClick: () => void,
    icon?: "play" | "pause"
  ) => (
    <Button
      disabled={busy || denial !== null}
      icon={icon}
      onClick={onClick}
      title={denial ?? undefined}
      variant="ghost"
    >
      {label}
    </Button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Eyebrow>Ações</Eyebrow>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {m.state === "PROPOSED" ? (
          <Button
            disabled={busy || denial !== null}
            onClick={() => run(() => approveMetric({ id: m.id }))}
            title={denial ?? undefined}
          >
            Aprovar no plano
          </Button>
        ) : null}
        {m.state === "MEASURING"
          ? decide("Pausar", () => setPending("pause"), "pause")
          : null}
        {m.state === "PAUSED"
          ? decide("Retomar", () => setPending("resume"), "play")
          : null}
        {m.state !== "PROPOSED" && m.role !== "PRIMARY"
          ? decide("Tornar primária", () => setPending("primary"))
          : null}
        {m.state === "FROZEN"
          ? decide("Pedir revisão de meta", () => setPending("review"))
          : null}
      </div>
      {denial ? (
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-faint)" }}>
          {denial}
        </p>
      ) : null}

      {m.state !== "PROPOSED" && mappings.length > 0 ? (
        <SourcePicker
          busy={busy}
          denial={mapDenial}
          mappings={mappings}
          onMap={(mappingId) =>
            run(() => mapMetricSource({ id: m.id, mappingId }))
          }
        />
      ) : null}
      {m.state === "NO_SOURCE" ? (
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-faint)" }}>
          Passa a Medindo sozinha quando a conexão da fonte estiver saudável.
        </p>
      ) : null}

      {pending ? (
        <CommentBox
          busy={busy}
          comment={comment}
          kind={pending}
          onCancel={() => setPending(null)}
          onChange={setComment}
          onConfirm={confirm}
        />
      ) : null}
      <Note error={error} />
      {notice ? (
        <output
          style={{ margin: 0, fontSize: 12.5, color: "var(--ink-muted)" }}
        >
          {notice}
        </output>
      ) : null}
    </div>
  );
}

// ── Edição (nova versão) ──────────────────────────────────────────────────────

function EditPanel({
  m,
  denial,
  owners,
  done,
}: {
  m: PlanMetricHistory["metric"];
  denial: string | null;
  owners: { id: string; name: string }[];
  done: () => void;
}) {
  const ids = useId();
  const frozen = m.state === "FROZEN";
  const [name, setName] = useState(m.name);
  const [formula, setFormula] = useState(m.formula);
  const [target, setTarget] = useState(
    m.target === null ? "" : String(m.target).replace(".", ",")
  );
  const [owner, setOwner] = useState(m.ownerId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const parsed =
      target.trim() === "" ? null : Number(target.replace(",", "."));
    const res = await editMetric({
      id: m.id,
      name,
      formula,
      ownerId: owner === "" ? null : owner,
      ...(frozen ? {} : { targetValue: parsed }),
    });
    setBusy(false);
    if (res.ok) {
      done();
      return;
    }
    setError(res.error);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Eyebrow>Editar (cria a versão v{m.version + 1})</Eyebrow>
      <Field htmlFor={`${ids}-name`} label="Nome">
        <Input
          disabled={denial !== null}
          id={`${ids}-name`}
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
      </Field>
      <Field htmlFor={`${ids}-formula`} label="Fórmula">
        <Textarea
          disabled={denial !== null}
          id={`${ids}-formula`}
          onChange={(e) => setFormula(e.target.value)}
          rows={2}
          value={formula}
        />
      </Field>
      <Field htmlFor={`${ids}-owner`} label="Responsável">
        <Select
          ariaLabel="Responsável pela métrica"
          id={`${ids}-owner`}
          onChange={setOwner}
          options={[
            { value: "", label: "Sem responsável" },
            ...owners.map((o) => ({ value: o.id, label: o.name })),
          ]}
          value={owner}
        />
      </Field>
      <Field
        hint={
          frozen
            ? "Meta congelada: só se muda pedindo revisão ao Scaffold."
            : ""
        }
        htmlFor={`${ids}-target`}
        label="Meta"
      >
        <Input
          disabled={denial !== null || frozen}
          id={`${ids}-target`}
          inputMode="decimal"
          onChange={(e) => setTarget(e.target.value)}
          value={target}
        />
      </Field>
      <div>
        <Button disabled={busy || denial !== null} onClick={save}>
          {busy ? "Salvando…" : "Salvar nova versão"}
        </Button>
      </div>
      <Note error={error} />
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function MetricModal({
  metricId,
  denial,
  mapDenial,
  mappings,
  owners,
  onChanged,
}: {
  metricId: string;
  denial: string | null;
  mapDenial: string | null;
  mappings: { id: string; label: string; healthy: boolean }[];
  owners: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const { close } = useModal();
  const fetcher = useCallback(
    () => getPlanMetric({ id: metricId }),
    [metricId]
  );
  const { data, loading, error, reload } =
    useSignalData<PlanMetricHistory>(fetcher);

  const done = useCallback(() => {
    reload();
    onChanged();
  }, [reload, onChanged]);

  if (error) {
    return (
      <ModalShell onClose={close} title="Métrica" width={760}>
        <ScreenError message={error} onRetry={reload} />
      </ModalShell>
    );
  }
  if (loading || !data) {
    return (
      <ModalShell onClose={close} title="Métrica" width={760}>
        <SkeletonCard />
      </ModalShell>
    );
  }

  const m = data.metric;
  return (
    <ModalShell
      icon="ruler"
      onClose={close}
      subtitle={`${m.roleLabel} · v${m.version} · ${PLAN_STATE_META[m.state].label}`}
      title={m.name}
      width={760}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {m.inVerdict ? null : (
          <p
            style={{
              margin: 0,
              padding: "9px 11px",
              borderRadius: "var(--r-sm)",
              background: "var(--amber-soft)",
              color: "var(--amber-text)",
              fontSize: 12.5,
            }}
          >
            Proposta: fica fora do veredito e do retorno até ser aprovada.
          </p>
        )}

        <div>
          <Eyebrow>Fórmula</Eyebrow>
          <div
            className="mono"
            style={{
              marginTop: 4,
              padding: "8px 10px",
              borderRadius: "var(--r-sm)",
              background: "var(--surface-3)",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {m.formula}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <Fact label="Direção">{DIRECTION_LABEL[m.direction]}</Fact>
          <Fact label="Meta">{formatMetricValue(m.target)}</Fact>
          <Fact label="Responsável">{m.ownerName ?? "—"}</Fact>
          <Fact label="Fonte">
            {m.source ? (
              <>
                {m.source.label}{" "}
                <span
                  style={{
                    color: m.source.healthy
                      ? "var(--green-text)"
                      : "var(--amber-text)",
                  }}
                >
                  · {m.source.healthy ? "saudável" : "conexão com problema"}
                </span>
              </>
            ) : (
              "Sem fonte"
            )}
          </Fact>
          <Fact label="Origem">
            {m.fromModelName
              ? `Modelo ${m.fromModelName}`
              : "Proposta fora do modelo"}
          </Fact>
          <Fact label="Baseline">{formatMetricValue(m.baseline)}</Fact>
        </div>

        <ActionsPanel
          denial={denial}
          done={done}
          m={m}
          mapDenial={mapDenial}
          mappings={mappings}
        />
        <EditPanel
          denial={denial}
          done={done}
          key={m.version}
          m={m}
          owners={owners}
        />

        <div>
          <Eyebrow>Observações da fonte</Eyebrow>
          {data.observations.length === 0 ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "var(--ink-faint)",
              }}
            >
              Nenhuma leitura ainda.
            </p>
          ) : (
            data.observations.map((o) => (
              <div
                className="mono"
                key={o.code}
                style={{
                  fontSize: 11.5,
                  padding: "4px 0",
                  color: "var(--ink-muted)",
                }}
              >
                {o.code} · {o.value}
                {o.unit ? ` ${o.unit}` : ""} ·{" "}
                {new Date(o.observedAt).toLocaleDateString("pt-BR")}
                {o.flag ? ` · ${o.flag}` : ""}
              </div>
            ))
          )}
        </div>

        <div>
          <Eyebrow>Histórico</Eyebrow>
          {data.events.map((e) => (
            <div
              key={e.id}
              style={{
                padding: "8px 0",
                borderBottom: "1px dashed var(--hairline)",
                fontSize: 12.5,
              }}
            >
              <strong>{ACTION_LABEL[e.action] ?? e.action}</strong>{" "}
              <span style={{ color: "var(--ink-faint)" }}>
                · v{e.version} · {e.actor} ·{" "}
                {new Date(e.at).toLocaleDateString("pt-BR")}
              </span>
              {e.comment ? (
                <div style={{ marginTop: 3, color: "var(--ink-muted)" }}>
                  {e.comment}
                </div>
              ) : null}
              {e.changes.map(([field, before, after]) => (
                <div
                  className="mono"
                  key={field}
                  style={{ fontSize: 11, color: "var(--ink-subtle)" }}
                >
                  {field}: {before} → {after}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Propor métrica ────────────────────────────────────────────────────────────

const PROPOSABLE = [
  { value: "GUARD", label: "Guarda — nunca piora para a primária melhorar" },
  { value: "ADOPTION", label: "Adoção — sem uso, o resultado não é da IA" },
  { value: "VALUE", label: "Valor — componente em R$ do retorno" },
] as const;

export function ProposeMetricForm({
  initiativeCode,
  onSaved,
}: {
  initiativeCode: string;
  onSaved: () => void;
}) {
  const { close } = useModal();
  const ids = useId();
  const [role, setRole] = useState<"GUARD" | "ADOPTION" | "VALUE">("GUARD");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const can = name.trim().length > 0 && formula.trim().length >= 3;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await proposeMetric({
      initiativeCode,
      role,
      name,
      formula,
      direction,
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
      close();
      return;
    }
    setError(res.error);
  };

  return (
    <ModalShell
      actions={
        <>
          <Button onClick={close} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!can || busy} onClick={submit}>
            {busy ? "Enviando…" : "Propor métrica"}
          </Button>
        </>
      }
      icon="plus"
      onClose={close}
      subtitle="Entra como proposta: fica fora do veredito e do retorno até o dono da iniciativa aprovar. A primária não se propõe; a troca dela tem regra própria."
      title="Propor métrica"
      width={620}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Note error={error} />
        <Field htmlFor={`${ids}-role`} label="Papel" required>
          <Select
            ariaLabel="Papel da métrica"
            id={`${ids}-role`}
            onChange={setRole}
            options={PROPOSABLE.map((p) => ({ ...p }))}
            value={role}
          />
        </Field>
        <Field htmlFor={`${ids}-name`} label="Nome" required>
          <Input
            id={`${ids}-name`}
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </Field>
        <Field
          hint="Texto verificável, ex.: reencaminhados ÷ pedidos."
          htmlFor={`${ids}-formula`}
          label="Fórmula"
          required
        >
          <Textarea
            id={`${ids}-formula`}
            onChange={(e) => setFormula(e.target.value)}
            rows={3}
            value={formula}
          />
        </Field>
        <Field htmlFor={`${ids}-dir`} label="Direção" required>
          <Select
            ariaLabel="Direção em que a métrica melhora"
            id={`${ids}-dir`}
            onChange={setDirection}
            options={[
              { value: "UP", label: DIRECTION_LABEL.UP },
              { value: "DOWN", label: DIRECTION_LABEL.DOWN },
            ]}
            value={direction}
          />
        </Field>
      </div>
    </ModalShell>
  );
}
