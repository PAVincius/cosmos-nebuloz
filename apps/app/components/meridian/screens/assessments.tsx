"use client";

// Carteira de assessments — US1. Port de `meridian-screens-1.jsx`.

import type { MeridianAssessmentStatus } from "@repo/database";
import {
  Avatar,
  Badge,
  Button,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  SkeletonKpi,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type AssessmentRow,
  createAssessment,
  listAssessments,
  listTemplates,
  type TemplateOption,
} from "@/app/(meridian)/actions/assessments";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { finalOf, scoreTone } from "@/lib/meridian/composite";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Field,
  FilterChips,
  Input,
  ModalProvider,
  ModalShell,
  ScreenError,
  Select,
  SkeletonCard,
  SmartEmptyState,
  TableHead,
  TableRow,
  useFieldId,
  useMeridianData,
  useModal,
} from "../base";

const COLS = "1.4fr 100px 130px 1.2fr 110px 110px";

const STATUS_META: Record<
  MeridianAssessmentStatus,
  { label: string; tone: Tone }
> = {
  DRAFT: { label: "Rascunho", tone: "accent" },
  COLLECTING: { label: "Coletando", tone: "blue" },
  REVIEW: { label: "Em revisão", tone: "amber" },
  FINALISED: { label: "Finalizado", tone: "green" },
};

const dateBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function NewAssessmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const orgNameId = useFieldId("new-assessment-org-name");
  const sectorId = useFieldId("new-assessment-sector");
  const sizeBandId = useFieldId("new-assessment-size-band");
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [orgName, setOrgName] = useState("");
  const [sector, setSector] = useState("");
  const [sizeBand, setSizeBand] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [benchmarkOptIn, setBenchmarkOptIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listTemplates().then((res) => {
      if (res.ok) {
        setTemplates(res.data);
        if (res.data[0]) {
          setTemplateId(res.data[0].id);
        }
      } else {
        setTemplates([]);
      }
    });
  }, []);

  const valid =
    orgName.trim().length > 0 &&
    sector.trim().length > 0 &&
    sizeBand.trim().length > 0 &&
    templateId.length > 0 &&
    deadline.length > 0;

  const submit = async () => {
    setBusy(true);
    const res = await runWithToast(
      () =>
        createAssessment({
          orgName,
          sector,
          sizeBand,
          templateId,
          deadline,
          benchmarkOptIn,
        }),
      {
        loading: "Criando assessment…",
        success: (d) => `${d.code} criado — segue pra atribuição de coleta.`,
      }
    );
    setBusy(false);
    if (res.ok) {
      onCreated(res.data.id);
    }
  };

  return (
    <ModalShell
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!valid || busy} icon="check" onClick={submit}>
            Criar assessment
          </Button>
        </>
      }
      icon="plus"
      onClose={onClose}
      subtitle="Congela a versão do template no primeiro uso — mudar peso depois não reescreve um diagnóstico já aberto."
      title="Novo assessment"
      width={560}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 20,
        }}
      >
        <Field htmlFor={orgNameId} label="Organização">
          <Input
            id={orgNameId}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Vanta Saúde"
            value={orgName}
          />
        </Field>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field htmlFor={sectorId} label="Setor">
            <Input
              id={sectorId}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Saúde"
              value={sector}
            />
          </Field>
          <Field htmlFor={sizeBandId} label="Porte">
            <Input
              id={sizeBandId}
              onChange={(e) => setSizeBand(e.target.value)}
              placeholder="200–1.000"
              value={sizeBand}
            />
          </Field>
        </div>
        <Field label="Template">
          <Select
            ariaLabel="Template"
            onChange={setTemplateId}
            options={(templates ?? []).map((t) => ({
              value: t.id,
              label: `${t.name} · ${t.version}`,
            }))}
            value={templateId}
          />
        </Field>
        <Field label="Prazo">
          <Input
            aria-label="Prazo"
            onChange={(e) => setDeadline(e.target.value)}
            type="date"
            value={deadline}
          />
        </Field>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ink-muted)",
          }}
        >
          <input
            checked={benchmarkOptIn}
            onChange={(e) => setBenchmarkOptIn(e.target.checked)}
            type="checkbox"
          />
          Contribuir para o pool de benchmark (anônimo, reversível)
        </label>
      </div>
    </ModalShell>
  );
}

function AssessmentsBody() {
  const router = useRouter();
  const modal = useModal();
  const [status, setStatus] = useState<"all" | MeridianAssessmentStatus>("all");

  const fetcher = useCallback(
    () => listAssessments(status === "all" ? {} : { status }),
    [status]
  );
  const { data, loading, error, reload } =
    useMeridianData<AssessmentRow[]>(fetcher);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const rows = data ?? [];
  const active = rows.filter((a) => a.status !== "FINALISED").length;
  const collecting = rows.filter((a) => a.status === "COLLECTING").length;
  // Eixos contestados de toda a carteira: é o que espera julgamento humano, e
  // é o número que decide se o dia da consultora começa aqui ou na fila.
  const contested = rows.reduce(
    (sum, a) =>
      sum + (a.scores?.filter((s) => s.status === "CONTESTED").length ?? 0),
    0
  );
  const evidence = rows.reduce((sum, a) => sum + a.evidence, 0);

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Diagnose · carteira"
        subtitle="Coleta multi-respondente, scoring assistido e plano sequenciado — um diagnóstico por vez."
        title="Assessments"
      >
        <Button
          icon="plus"
          onClick={() =>
            modal.open(
              <NewAssessmentModal
                onClose={modal.close}
                onCreated={(id) => {
                  modal.close();
                  reload();
                  router.push(`/meridian/assessment/${id}`);
                }}
              />
            )
          }
        >
          Novo assessment
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            <KpiCard
              hint={`${rows.length - active} finalizado(s)`}
              icon="compass"
              label="Assessments ativos"
              tone="accent"
              value={active}
            />
            <KpiCard
              hint="lembretes automáticos rodando"
              icon="mail"
              label="Em coleta"
              tone="blue"
              value={collecting}
            />
            <KpiCard
              hint="aguardando revisão do consultor"
              icon="gavel"
              label="Eixos contestados"
              tone={contested ? "amber" : "green"}
              value={contested}
            />
            <KpiCard
              hint="armazenamento segregado por organização"
              icon="paperclip"
              label="Evidências anexadas"
              tone="purple"
              value={evidence}
            />
          </>
        )}
      </div>

      <SectionCard
        action={
          <FilterChips
            allLabel="Todos"
            ariaLabel="Filtrar por status"
            onChange={(v) => setStatus(v as typeof status)}
            options={(
              Object.keys(STATUS_META) as MeridianAssessmentStatus[]
            ).map((id) => ({
              id,
              label: STATUS_META[id].label,
              tone: STATUS_META[id].tone,
            }))}
            value={status}
          />
        }
        bodyStyle={{ padding: 0 }}
        icon="compass"
        title="Carteira"
      >
        {loading ? (
          <div style={{ padding: 16 }}>
            <SkeletonCard />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24 }}>
            <SmartEmptyState
              icon="compass"
              onPrimary={() => setStatus("all")}
              primaryIcon="x"
              primaryLabel="Ver todos"
              subtitle="Ajuste o status para ver outros assessments."
              title="Nada neste filtro"
              tone="accent"
            />
          </div>
        ) : (
          <div className="scroll" style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 760 }}>
              <TableHead
                cols={COLS}
                labels={[
                  "Organização",
                  "Template",
                  "Respostas",
                  "Composite por eixo",
                  "Prazo",
                  { t: "Status", align: "right" },
                ]}
              />
              {rows.map((a, i) => (
                <TableRow
                  cols={COLS}
                  key={a.id}
                  label={`Abrir assessment ${a.orgName}`}
                  last={i === rows.length - 1}
                  onClick={() => router.push(`/meridian/assessment/${a.id}`)}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <Avatar name={a.orgName} size={28} tone="accent" />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 12.5,
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.orgName}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 10,
                          color: "var(--ink-faint)",
                          fontWeight: 600,
                        }}
                      >
                        {a.code} · {a.sector} · {a.sizeBand}
                        {a.reassessmentOfCode
                          ? ` · re-run de ${a.reassessmentOfCode}`
                          : ""}
                      </span>
                    </span>
                  </span>

                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--ink-muted)" }}
                  >
                    {a.templateVersion}
                  </span>

                  <span
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <span style={{ flex: 1 }}>
                      <Progress
                        height={5}
                        tone="accent"
                        value={
                          a.responses.total
                            ? Math.round(
                                (a.responses.done / a.responses.total) * 100
                              )
                            : 0
                        }
                      />
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-faint)",
                        flexShrink: 0,
                      }}
                    >
                      {a.responses.done}/{a.responses.total}
                    </span>
                  </span>

                  <span
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {a.scores && a.composite !== null ? (
                      <>
                        <span
                          className="display"
                          style={{
                            fontSize: 21,
                            fontWeight: 700,
                            letterSpacing: "-.02em",
                            color: `var(--${scoreTone(a.composite)}-text)`,
                            width: 34,
                            textAlign: "right",
                            flexShrink: 0,
                          }}
                        >
                          {a.composite}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            gap: 4,
                            alignItems: "flex-end",
                            height: 24,
                          }}
                        >
                          {AXIS_IDS.map((x) => {
                            const s = a.scores?.find((v) => v.axis === x);
                            if (!s) {
                              return null;
                            }
                            const v = finalOf(s);
                            return (
                              <span
                                key={x}
                                style={{
                                  width: 10,
                                  height: Math.max(4, (v / 100) * 24),
                                  borderRadius: 2,
                                  background: `var(--${scoreTone(v)})`,
                                  opacity: 0.85,
                                }}
                                title={`${AXES[x].label}: ${v}`}
                              />
                            );
                          })}
                        </span>
                      </>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--ink-faint)",
                          fontWeight: 500,
                        }}
                      >
                        sem scoring
                      </span>
                    )}
                  </span>

                  {/* Data em linha única: "12 de out. de 2026" quebrava em duas
                    linhas numa coluna de 110px e desalinhava a linha inteira. */}
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {dateBR(a.deadline)}
                  </span>

                  <span style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Badge
                      dot={a.status === "COLLECTING"}
                      tone={STATUS_META[a.status].tone}
                    >
                      {STATUS_META[a.status].label}
                    </Badge>
                  </span>
                </TableRow>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function AssessmentsScreen() {
  return (
    <ModalProvider>
      <AssessmentsBody />
    </ModalProvider>
  );
}
