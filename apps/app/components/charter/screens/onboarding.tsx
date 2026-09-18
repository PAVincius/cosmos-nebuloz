"use client";

// Onboarding e Aceite — FR-10. Port de `charter-screens-3.jsx`.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  acknowledge,
  getOnboarding,
  publishTrack,
  type TrackRow,
} from "@/app/(charter)/actions/onboarding";
import { getPolicy } from "@/app/(charter)/actions/policy";
import { SECTION_STATUS_LABEL, type Tone } from "@/lib/charter/rules";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Field,
  GatedButton,
  Legend,
  ScreenError,
  SkeletonCard,
  SkeletonRows,
  SmartEmptyState,
  TableRow,
  Textarea,
  useFieldId,
} from "../base";
import { DisclosurePanel } from "../disclosure-panel";
import { ModalProvider, ModalShell, useModal } from "../modal";
import { PublishTrackModal } from "../modals/publish-track";
import { FS } from "../type-scale";
import { useCharterData } from "../use-charter-data";

const PENDING_COLS = "minmax(0,1fr) 78px 48px 92px";
const GOOD_COVERAGE = 90;
const FAIR_COVERAGE = 70;
const ACK_DEADLINE_DAYS = 14;

// O que o aceite registra — copy normativa do protótipo, não dado de tela.
const ACK_GUARANTEES = [
  "A versão exata da política que a pessoa leu — não apenas a data do clique.",
  "Módulos concluídos e resultado do quiz, quando aplicável.",
  "Re-aceite obrigatório quando a versão vinculada muda.",
  "Trilha imutável: aceite não pode ser editado, apenas superado por novo aceite.",
];

function coverageTone(pct: number): Tone {
  if (pct >= GOOD_COVERAGE) {
    return "green";
  }
  if (pct >= FAIR_COVERAGE) {
    return "amber";
  }
  return "red";
}

function recertLabel(recert: string): string {
  return recert === "ANNUAL" ? "anual" : "semestral";
}

function TrackCard({ track, last }: { track: TrackRow; last: boolean }) {
  const tone = coverageTone(track.coverage);
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: `var(--${tone}-soft)`,
            color: `var(--${tone}-text)`,
            border: `1px solid rgba(var(--${tone}-rgb),.25)`,
          }}
        >
          <Icon name="book" size={14} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: FS.base,
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {track.name}
            </span>
            <Badge tone={track.needsReassignment ? "amber" : "green"}>
              {track.policyVersion ?? "sem versão"}
            </Badge>
            {track.overdue > 0 && (
              <Badge tone="red">{track.overdue} atrasados</Badge>
            )}
          </div>
          <div
            style={{
              fontSize: FS.nota,
              color: "var(--ink-muted)",
              marginTop: 3,
            }}
          >
            {track.audience} · {track.modules} módulos · {track.minutes} min ·
            re-certificação {recertLabel(track.recert)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span
            className="mono"
            style={{
              fontSize: FS.forte,
              fontWeight: 800,
              color: `var(--${tone}-text)`,
            }}
          >
            {track.coverage}%
          </span>
          <div
            style={{
              fontSize: FS.micro,
              color: "var(--ink-faint)",
              marginTop: 1,
            }}
          >
            {track.done}/{track.assigned}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Progress height={6} tone={tone} value={track.coverage} />
      </div>
    </div>
  );
}

const JUSTIFICATIVA_MIN = 10;

/** "Registrar" nesta lista é sempre em nome de outra pessoa — a lista de
 *  pendências não tem uma linha de "meu próprio aceite", só nomes livres
 *  atribuídos por quem publicou a trilha. Sem isto, um clique fabricava
 *  evidência de que {personName} leu a política sem dizer quem de fato
 *  registrou nem por quê. */
function AckThirdPartyModal({
  ackId,
  personName,
  policyVersion,
  onChanged,
}: {
  ackId: string;
  personName: string;
  policyVersion: string | null;
  onChanged: () => void;
}) {
  const { close } = useModal();
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);
  const podeConfirmar = justificativa.trim().length >= JUSTIFICATIVA_MIN;
  const fieldId = useFieldId("ack-justificativa");

  const confirmar = async () => {
    if (!podeConfirmar || saving) {
      return;
    }
    setSaving(true);
    const res = await runWithToast(
      () => acknowledge({ id: ackId, justificativa: justificativa.trim() }),
      { loading: "Registrando aceite…", success: "Aceite registrado" }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onChanged();
    }
  };

  return (
    <ModalShell
      footer={
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
          }}
        >
          {!podeConfirmar && (
            <span style={{ fontSize: FS.nota, color: "var(--ink-faint)" }}>
              Descreva em pelo menos {JUSTIFICATIVA_MIN} caracteres por que você
              está registrando por {personName}.
            </span>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button onClick={close} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedButton
              allowed={podeConfirmar && !saving}
              icon="check"
              onClick={confirmar}
              reason={`Descreva em pelo menos ${JUSTIFICATIVA_MIN} caracteres por que você está registrando por ${personName}.`}
            >
              {saving ? "Registrando…" : "Registrar aceite"}
            </GatedButton>
          </div>
        </div>
      }
      icon="alert"
      onClose={close}
      subtitle={
        policyVersion
          ? `Política versão ${policyVersion}`
          : "Política vigente da trilha"
      }
      title={`Registrar aceite em nome de ${personName}?`}
      tone="amber"
      width={480}
    >
      <div
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <p
          style={{
            fontSize: FS.base,
            color: "var(--ink-muted)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Isto cria evidência de que {personName} aceitou a política
          {policyVersion ? ` versão ${policyVersion}` : ""}. Você está
          registrando o aceite em nome de {personName} — não é {personName}
          quem está confirmando agora.
        </p>
        <Field
          hint={`Mínimo de ${JUSTIFICATIVA_MIN} caracteres — vira parte da trilha de auditoria`}
          htmlFor={fieldId}
          label="Justificativa"
        >
          <Textarea
            id={fieldId}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: Fulano está de licença médica e me pediu para registrar após ler o material impresso."
            value={justificativa}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();

  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getOnboarding(), [])
  );
  const policy = useCharterData(useCallback(() => getPolicy(), []));

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const tracks = data?.tracks ?? [];
  const acks = data?.pending ?? [];
  const pct = data?.coverage.pct ?? 0;
  const overdue = tracks.reduce((sum, t) => sum + t.overdue, 0);
  const modules = tracks.reduce((sum, t) => sum + t.modules, 0);
  const stale = tracks.filter((t) => t.needsReassignment);

  const openPublish = () =>
    open(
      <PublishTrackModal
        onClose={close}
        onSubmit={(input) =>
          startTransition(async () => {
            const res = await runWithToast(() => publishTrack(input), {
              loading: "Publicando trilha…",
              success: (d) =>
                `${d.code} publicada · ${d.assigned} pessoas atribuídas`,
            });
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
        policyVersion={policy.data?.version ?? null}
        sections={(policy.data?.sections ?? []).map((s) => ({
          id: s.id,
          ordinal: s.ordinal,
          name: s.name,
          status: s.status,
          statusLabel: SECTION_STATUS_LABEL[s.status],
          words: s.words,
        }))}
      />
    );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={`${tracks.length} trilhas ativas · política ${policy.data?.version ?? "—"} · ${data?.coverage.assigned ?? 0} pessoas atribuídas`}
        meta={
          <>
            <Badge dot tone={pct >= GOOD_COVERAGE ? "green" : "amber"}>
              {pct}% de aceite
            </Badge>
            <Badge tone={overdue > 0 ? "red" : "green"}>
              {overdue} atrasados
            </Badge>
            {stale.length > 0 && (
              <Badge tone="amber">
                {stale.length} trilha(s) em versão antiga
              </Badge>
            )}
          </>
        }
        subtitle="Política publicada não é política comunicada. Aqui a regra vira comportamento — e o aceite vira evidência."
        title="Onboarding e Aceite"
        tone="green"
      >
        <Button
          icon="download"
          onClick={() => router.push("/charter/audit")}
          variant="secondary"
        >
          Relatório de conclusão
        </Button>
        <Button icon="plus" onClick={openPublish}>
          Publicar trilha
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        {loading ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          <>
            <KpiCard
              hint="aceite de política registrado"
              icon="userCheck"
              label="Aceite da política"
              tone={pct >= GOOD_COVERAGE ? "green" : "amber"}
              unit="%"
              value={pct}
            />
            <KpiCard
              hint={`prazo de ${ACK_DEADLINE_DAYS} dias`}
              icon="clock"
              label="Aceites atrasados"
              tone={overdue > 0 ? "red" : "green"}
              value={overdue}
            />
            <KpiCard
              hint={`${modules} módulos`}
              icon="layers"
              label="Trilhas ativas"
              tone="accent"
              value={tracks.length}
            />
            <KpiCard
              hint={
                stale.length > 0
                  ? `${stale.length} aguardando reatribuição`
                  : "atualizadas"
              }
              icon="fileText"
              label="Trilhas na versão vigente"
              tone={stale.length > 0 ? "amber" : "green"}
              value={`${tracks.length - stale.length}/${tracks.length}`}
            />
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          bodyStyle={{ padding: 0 }}
          icon="layers"
          subtitle="Conteúdo genérico não muda comportamento — cada público recebe o que se aplica a ele"
          title="Trilhas por público"
          tone="green"
        >
          {loading ? (
            <div
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : tracks.length === 0 ? (
            <SmartEmptyState
              icon="layers"
              onPrimary={openPublish}
              primaryIcon="plus"
              primaryLabel="Publicar primeira trilha"
              subtitle="Política publicada não é política comunicada. Sem trilha não há prova de que as pessoas foram informadas."
              title="Nenhuma trilha publicada"
              tone="green"
            />
          ) : (
            <>
              {tracks.map((t, i) => (
                <TrackCard
                  key={t.id}
                  last={i === tracks.length - 1}
                  track={t}
                />
              ))}
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid var(--hairline)",
                }}
              >
                <Legend
                  items={[
                    { tone: "green", label: "≥90% concluído" },
                    { tone: "amber", label: "70–89%" },
                    {
                      tone: "red",
                      label: "<70% — risco de política não comunicada",
                    },
                  ]}
                  style={{ marginTop: 0 }}
                />
              </div>
            </>
          )}
        </SectionCard>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            bodyStyle={{ padding: 0 }}
            icon="clock"
            subtitle="Ordenado por dias desde a atribuição"
            title="Aceites pendentes"
            tone="amber"
          >
            {loading ? (
              <SkeletonRows cols={PENDING_COLS} rows={4} />
            ) : acks.length === 0 ? (
              <SmartEmptyState
                icon="check"
                subtitle="Todo mundo com trilha atribuída já registrou aceite."
                title="Nenhum aceite pendente"
                tone="green"
              />
            ) : (
              acks.map((p, i) => (
                <TableRow
                  cols={PENDING_COLS}
                  key={p.id}
                  last={i === acks.length - 1}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      minWidth: 0,
                    }}
                  >
                    <Avatar name={p.personName} size={26} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: FS.base,
                          fontWeight: 600,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.personName}
                      </div>
                      <div
                        style={{
                          fontSize: FS.micro,
                          color: "var(--ink-faint)",
                        }}
                      >
                        {p.department ?? "—"}
                      </div>
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: FS.nota, color: "var(--ink-muted)" }}
                    title={p.trackName}
                  >
                    {p.trackCode}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: FS.nota,
                      fontWeight: 700,
                      textAlign: "right",
                      color:
                        p.daysLate > ACK_DEADLINE_DAYS
                          ? "var(--red-text)"
                          : "var(--amber-text)",
                    }}
                  >
                    {p.daysLate}d
                  </span>
                  {/* O protótipo tem "reenviar pedido"; aqui o que existe de
                      verdade é registrar o aceite (FR-10.3). Toda linha
                      desta lista é em nome de outra pessoa — não há aceite
                      próprio aqui —, então "Registrar" sempre confirma
                      antes, com justificativa (Bloco 2 da crítica de
                      design: evidência fabricada com um clique). */}
                  <Button
                    icon="check"
                    onClick={() =>
                      open(
                        <AckThirdPartyModal
                          ackId={p.id}
                          onChanged={reload}
                          personName={p.personName}
                          policyVersion={
                            tracks.find((t) => t.code === p.trackCode)
                              ?.policyVersion ?? null
                          }
                        />
                      )
                    }
                    size="sm"
                    variant="soft"
                  >
                    Registrar
                  </Button>
                </TableRow>
              ))
            )}
          </SectionCard>

          <DisclosurePanel
            icon="scale"
            id="onboarding-o-que-o-aceite-registra"
            subtitle="Por que isso vale em auditoria"
            title="O que o aceite registra"
            tone="accent"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {ACK_GUARANTEES.map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    gap: 9,
                    fontSize: FS.base,
                    color: "var(--ink-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  <Icon
                    name="check"
                    size={14}
                    style={{
                      color: "var(--accent-text)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  {t}
                </div>
              ))}
            </div>
          </DisclosurePanel>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingScreen() {
  return (
    <ModalProvider>
      <OnboardingInner />
    </ModalProvider>
  );
}
