"use client";

// Detalhe da iniciativa — US2. Port de `signal-screens-2.jsx`.
//
// A tela que carrega a tese do produto. A ordem dos blocos NÃO é estética:
//
//   1. veredito e ação sugerida — a decisão
//   2. encerramento, quando houver — por que pararam
//   3. adoção E resultado, lado a lado, sempre — nunca um sem o outro
//   4. ROI aberto em componentes, custos e premissas — a conta inteira
//   5. confiança fator a fator, com o motivo de cada desconto
//   6. baseline assinado — a régua contra a qual tudo isso é medido
//
// Quem lê de cima para baixo passa por "escale isto" antes de ver o número que
// justifica; e não chega ao número sem ter visto de onde ele sai.
//
// Cada bloco é um componente próprio: a versão anterior era uma função de 350
// linhas, e nela um `if` a mais em qualquer lugar tornava impossível enxergar a
// ordem acima — que é o conteúdo normativo desta tela.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  getInitiative,
  type InitiativeDetail,
  transitionInitiative,
} from "@/app/(signal)/actions/initiatives";
import { fmtAdoption } from "@/lib/signal/adoption";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/signal/lifecycle";
import { fmtDelta } from "@/lib/signal/outcome";
import { fmtBRL, fmtMultiple } from "@/lib/signal/roi";
import {
  Eyebrow,
  ScreenError,
  SkeletonCard,
  useModal,
  useSignalData,
} from "../base";
import { AdoptionSparkline, OutcomeSparkline } from "../charts";
import { Note } from "../list-card";
import { BaselineForm, CloseInitiativeForm, ObservationForm } from "../modal";
import { ValueReading } from "../verdict-badge";

type D = InitiativeDetail;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "7px 0",
        borderBottom: "1px dashed var(--hairline)",
      }}
    >
      <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{label}</span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink)",
          textAlign: "right",
        }}
      >
        {children}
      </span>
    </div>
  );
}

/** Valor grande com a fonte logo abaixo, usado nos totais do ROI. */
function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span>
      <Eyebrow>{label}</Eyebrow>
      <div
        className="display"
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: tone ? `var(--${tone}-text)` : "var(--ink)",
        }}
      >
        {value}
      </div>
    </span>
  );
}

/** Linha de componente/custo, sempre com a origem ao lado do número. */
function SourcedRow({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source: string;
}) {
  return (
    <Row label={label}>
      {value}{" "}
      <span
        className="mono"
        style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
      >
        {source}
      </span>
    </Row>
  );
}

function VerdictCard({ d }: { d: D }) {
  return (
    <SectionCard title="Veredito">
      <ValueReading
        adoptionPct={d.adoption.pct}
        confidenceBand={d.confidence.band}
        confidenceScore={d.confidence.score}
        formulaVersion={d.roi.version}
        multiple={d.roi.multiple}
        verdictAction={d.verdict.action}
        verdictLabel={d.verdict.label}
        verdictTone={d.verdict.tone}
      />
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "var(--ink-muted)",
        }}
      >
        {d.verdict.why}
      </p>
      {/* As réguas ficam visíveis porque o veredito depende delas: quem discorda
          do rótulo precisa saber contra o que ele foi comparado. */}
      <p
        className="mono"
        style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--ink-faint)" }}
      >
        Réguas desta organização: adoção ≥ {d.bars.adoptionBar}% · retorno ≥{" "}
        {fmtMultiple(d.bars.valueBar)}
      </p>
    </SectionCard>
  );
}

function ClosureCard({ closure }: { closure: NonNullable<D["closure"]> }) {
  return (
    <SectionCard title="Encerramento" tone="red">
      <Row label="Quando">
        {new Date(closure.at).toLocaleDateString("pt-BR")}
      </Row>
      <Row label="Por quem">{closure.by}</Row>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "var(--ink-muted)",
        }}
      >
        {closure.reason}
      </p>
    </SectionCard>
  );
}

function AdoptionCard({
  adoption,
  adoptionBar,
}: {
  adoption: D["adoption"];
  adoptionBar: number;
}) {
  return (
    <SectionCard title="Adoção">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          className="display"
          style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em" }}
        >
          {fmtAdoption(adoption.pct)}
        </div>
        <AdoptionSparkline adoptionBar={adoptionBar} values={adoption.trend} />
      </div>
      <Row label="Usuários ativos">
        {adoption.activeUsers} de {adoption.licensedUsers} licenciados
      </Row>
      {adoption.frequencyLabel ? (
        <Row label="Frequência">{adoption.frequencyLabel}</Row>
      ) : null}
      {adoption.deltaPoints === null ? null : (
        <Row label="Contra o período anterior">
          {adoption.deltaPoints > 0 ? "+" : "−"}
          {Math.abs(Math.round(adoption.deltaPoints))} pontos
        </Row>
      )}
      {adoption.depthNote ? (
        // `Eyebrow` é um <div>: dentro de <p> o React reabre o parágrafo e o
        // HTML hidrata diferente do servidor. Bloco rotulado é o `Note`.
        <Note label="Profundidade de uso">{adoption.depthNote}</Note>
      ) : null}
    </SectionCard>
  );
}

function OutcomeCard({ outcome }: { outcome: D["outcome"] }) {
  const { primary, secondary } = outcome;
  if (!primary) {
    return (
      <SectionCard title="Resultado">
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-faint)" }}>
          Ainda não há medição de resultado. Adoção sem resultado não sustenta
          decisão — é meia verdade.
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Resultado">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          className="display"
          style={{
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "-.03em",
            color: `var(--${primary.tone}-text)`,
          }}
        >
          {fmtDelta(primary.deltaPct)}
        </div>
        <OutcomeSparkline
          direction={primary.direction}
          values={primary.trend}
        />
      </div>
      <Row label={primary.metricLabel}>
        {primary.baselineValue}{" "}
        <span style={{ color: "var(--ink-faint)" }}>→</span>{" "}
        {primary.currentValue}
      </Row>
      {/* A métrica de guarda existe para revelar o preço escondido do ganho: o
          tempo caiu, mas o CSAT caiu junto? */}
      {secondary ? (
        <Row label={`${secondary.metricLabel} (guarda)`}>
          {secondary.baselineValue}{" "}
          <span style={{ color: "var(--ink-faint)" }}>→</span>{" "}
          <span style={{ color: `var(--${secondary.tone}-text)` }}>
            {secondary.currentValue}
          </span>{" "}
          <span className="mono" style={{ fontSize: 11 }}>
            {fmtDelta(secondary.deltaPct)}
          </span>
        </Row>
      ) : null}
    </SectionCard>
  );
}

function RoiCard({
  roi,
  code,
  onChanged,
}: {
  roi: D["roi"];
  code: string;
  onChanged: () => void;
}) {
  const modal = useModal();
  const subtitle = roi.version
    ? `Fórmula v${roi.version} · horizonte de ${roi.horizonMonths} meses`
    : "Nenhuma fórmula versionada ainda.";
  const addObservation = () =>
    modal.open(<ObservationForm initiativeCode={code} onSaved={onChanged} />);

  if (roi.steps.length === 0) {
    return (
      <SectionCard subtitle={subtitle} title="Retorno">
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12.5,
            color: "var(--ink-faint)",
          }}
        >
          Sem componentes lançados. O múltiplo aparece como “sem lastro” até a
          primeira fórmula ser versionada.
        </p>
        <Button icon="fileText" onClick={addObservation} variant="ghost">
          Registrar observação
        </Button>
      </SectionCard>
    );
  }

  const returns = roi.steps.filter((s) => s.kind === "RETURN");
  const costs = roi.steps.filter((s) => s.kind === "COST");

  return (
    <SectionCard subtitle={subtitle} title="Retorno">
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <Figure label="Retornou" value={fmtBRL(roi.returned)} />
        <Figure label="Investiu" value={fmtBRL(roi.invested)} />
        <Figure
          label="Líquido"
          tone={roi.net >= 0 ? "green" : "red"}
          value={fmtBRL(roi.net)}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Eyebrow>Componentes de retorno</Eyebrow>
        {returns.map((s) => (
          <SourcedRow
            key={s.label}
            label={s.label}
            source={s.sourceLabel}
            value={fmtBRL(s.total)}
          />
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <Eyebrow>Custos</Eyebrow>
        {costs.map((s) => (
          <SourcedRow
            key={s.label}
            label={s.label}
            source={s.sourceLabel}
            value={fmtBRL(s.total)}
          />
        ))}
      </div>

      {/* Premissa sem nota é número sem defesa: "R$ 84" não se sustenta em
          comitê, "folha + encargos ÷ 1.760 h" se sustenta. */}
      {roi.assumptions.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <Eyebrow>Premissas</Eyebrow>
          {roi.assumptions.map((a) => (
            <Row key={a.label} label={a.label}>
              {a.value}{" "}
              <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                — {a.note}
              </span>
            </Row>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}

function ConfidenceCard({ confidence }: { confidence: D["confidence"] }) {
  return (
    <SectionCard
      subtitle="O score não diz se a iniciativa é boa; diz se dá para confiar na medição dela."
      title={`Confiança ${confidence.score} · ${confidence.bandLabel}`}
    >
      {confidence.factors.map((f) => (
        <div
          key={f.key}
          style={{
            padding: "8px 0",
            borderBottom: "1px dashed var(--hairline)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              {f.label}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: f.lost === 0 ? "var(--green-text)" : "var(--amber-text)",
              }}
            >
              {f.got}/{f.weight}
            </span>
          </div>
          {/* O motivo do desconto é o que transforma o score de número
              autoritário em argumento contestável. */}
          {f.note ? (
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 11.5,
                lineHeight: 1.5,
                color: "var(--ink-faint)",
              }}
            >
              {f.note}
            </p>
          ) : null}
        </div>
      ))}
    </SectionCard>
  );
}

function BaselineCard({
  baseline,
  code,
  onChanged,
}: {
  baseline: D["baseline"];
  code: string;
  onChanged: () => void;
}) {
  const modal = useModal();
  const capture = () =>
    modal.open(<BaselineForm initiativeCode={code} onSaved={onChanged} />);

  if (!baseline) {
    return (
      <SectionCard subtitle="Ainda não assinado." title="Baseline">
        <p
          style={{
            margin: "0 0 12px",
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12.5,
            color: "var(--amber-text)",
          }}
        >
          <Icon name="alert" size={14} />
          Sem baseline assinado. Enquanto não houver, o ganho medido não tem
          contra-prova e a iniciativa não pode ser ativada.
        </p>
        <Button icon="ruler" onClick={capture}>
          Capturar baseline
        </Button>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      subtitle={`v${baseline.version} · ${baseline.windowLabel} · assinado por ${baseline.signedBy}`}
      title="Baseline"
    >
      {baseline.dimensions.map((dim) => (
        <SourcedRow
          key={dim.key}
          label={dim.label}
          source={dim.sourceLabel}
          value={dim.value}
        />
      ))}
    </SectionCard>
  );
}

function AlertsCard({ alerts }: { alerts: D["alerts"] }) {
  return (
    <SectionCard title="Alertas abertos" tone="red">
      {alerts.map((a) => (
        <div
          key={a.code}
          style={{
            padding: "8px 0",
            borderBottom: "1px dashed var(--hairline)",
          }}
        >
          <div style={{ fontSize: 12.5, color: "var(--ink)" }}>{a.what}</div>
          {/* Alerta sem próximo passo treina a organização a ignorar a fila. */}
          <div
            style={{ marginTop: 3, fontSize: 11.5, color: "var(--ink-subtle)" }}
          >
            <strong>Próximo passo:</strong> {a.nextStep}
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

/**
 * Controles de ciclo de vida.
 *
 * O botão de ativar aparece mesmo sem baseline, e é deliberado: escondê-lo
 * deixaria a pessoa sem saber por que a iniciativa não sai do rascunho. Ele
 * aparece, ela clica, e o servidor responde com a regra nomeada — que é onde a
 * explicação pertence, porque é a mesma regra que vale para qualquer chamada.
 */
function LifecycleBar({
  code,
  status,
  onChanged,
}: {
  code: string;
  status: D["status"];
  onChanged: () => void;
}) {
  const modal = useModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);

  const go = async (to: D["status"], reason?: string) => {
    setBusy(true);
    setError(null);
    setBlockers([]);
    const res = await transitionInitiative({ code, to, reason });
    setBusy(false);
    if (res.ok) {
      onChanged();
      return;
    }
    setError(res.error);
    setBlockers(res.blockers ?? []);
  };

  const askToClose = () =>
    modal.open(
      <CloseInitiativeForm
        code={code}
        onClosed={async (reason) => {
          const res = await transitionInitiative({
            code,
            to: "CLOSED",
            reason,
          });
          if (res.ok) {
            onChanged();
            return { ok: true };
          }
          // O erro volta para DENTRO do formulário: fechar o modal e mostrar o
          // problema atrás dele faria a pessoa perder o texto que escreveu.
          return { ok: false, error: res.error };
        }}
      />
    );

  if (status === "CLOSED" || status === "CANCELLED") {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {status === "DRAFT" ? (
          <Button disabled={busy} icon="play" onClick={() => go("ACTIVE")}>
            Ativar
          </Button>
        ) : null}
        {status === "ACTIVE" ? (
          <Button
            disabled={busy}
            icon="pause"
            onClick={() => go("PAUSED")}
            variant="ghost"
          >
            Pausar
          </Button>
        ) : null}
        {status === "PAUSED" ? (
          <Button disabled={busy} icon="play" onClick={() => go("ACTIVE")}>
            Retomar
          </Button>
        ) : null}
        {status === "ACTIVE" || status === "PAUSED" ? (
          <Button
            disabled={busy}
            icon="ban"
            onClick={askToClose}
            variant="ghost"
          >
            Encerrar
          </Button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            padding: "9px 11px",
            borderRadius: "var(--r-sm)",
            background: "var(--red-soft)",
            border: "1px solid rgba(var(--red-rgb),.3)",
            color: "var(--red-text)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {error}
          {blockers.length > 0 ? (
            <ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function InitiativeDetailScreen({ param }: { param?: string }) {
  const code = param ?? "";
  const fetcher = useCallback(() => getInitiative({ code }), [code]);
  const { data, loading, error, reload } = useSignalData<D>(fetcher);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading || !data) {
    return <SkeletonCard />;
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow={`${data.code} · ${CATEGORY_LABEL[data.category]} · ${data.businessUnit}`}
        subtitle={data.hypothesis}
        title={data.name}
        tone={data.verdict.tone}
      >
        <LifecycleBar
          code={data.code}
          onChanged={reload}
          status={data.status}
        />
      </PageHeader>

      <VerdictCard d={data} />
      {data.closure ? <ClosureCard closure={data.closure} /> : null}

      <div
        style={{
          display: "grid",
          gap: "var(--gap)",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        }}
      >
        <AdoptionCard
          adoption={data.adoption}
          adoptionBar={data.bars.adoptionBar}
        />
        <OutcomeCard outcome={data.outcome} />
      </div>

      <RoiCard code={data.code} onChanged={reload} roi={data.roi} />
      <ConfidenceCard confidence={data.confidence} />
      <BaselineCard
        baseline={data.baseline}
        code={data.code}
        onChanged={reload}
      />
      {data.alerts.length > 0 ? <AlertsCard alerts={data.alerts} /> : null}

      <p
        className="mono"
        style={{ fontSize: 10.5, color: "var(--ink-faint)", margin: 0 }}
      >
        {data.evidenceCount} observação(ões) de métrica sustentam estes números
        · status {STATUS_LABEL[data.status]}
      </p>
    </div>
  );
}
