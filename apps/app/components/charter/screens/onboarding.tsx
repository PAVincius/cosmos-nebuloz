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
import { useCallback, useTransition } from "react";
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
  Legend,
  ScreenError,
  SkeletonCard,
  SkeletonRows,
  SmartEmptyState,
  TableRow,
} from "../base";
import { ModalProvider, useModal } from "../modal";
import { PublishTrackModal } from "../modals";
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
              style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}
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
            style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 3 }}
          >
            {track.audience} · {track.modules} módulos · {track.minutes} min ·
            re-certificação {recertLabel(track.recert)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span
            className="mono"
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: `var(--${tone}-text)`,
            }}
          >
            {track.coverage}%
          </span>
          <div
            style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 1 }}
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
                          fontSize: 12.5,
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
                        style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
                      >
                        {p.department ?? "—"}
                      </div>
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-muted)" }}
                    title={p.trackName}
                  >
                    {p.trackCode}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
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
                      verdade é registrar o aceite (FR-10.3). */}
                  <Button
                    icon="check"
                    onClick={() =>
                      startTransition(async () => {
                        const res = await runWithToast(
                          () => acknowledge({ id: p.id }),
                          {
                            loading: "Registrando aceite…",
                            success: "Aceite registrado",
                          }
                        );
                        if (res.ok) {
                          reload();
                        }
                      })
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

          <SectionCard
            icon="scale"
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
                    fontSize: 12.5,
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
          </SectionCard>
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
