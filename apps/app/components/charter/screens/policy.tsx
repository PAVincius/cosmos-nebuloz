"use client";

// Policy Builder — FR-2. Port de `charter-screens-1.jsx`.
//
// Três abas: Seções (master-detail), Histórico de versões (timeline) e
// Prontidão para publicar (bloqueadores + impacto). O master-detail existe
// porque a política tem nove seções com ciclo próprio — uma pilha de cards
// obrigaria a rolar para comparar status.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useState, useTransition } from "react";
import { listRequirementSets } from "@/app/(charter)/actions/compliance";
import { getOnboarding } from "@/app/(charter)/actions/onboarding";
import {
  editSection,
  getPolicy,
  getVersionDiff,
  publishPolicyVersion,
  saveGeneratedDraft,
  setSectionStatus,
} from "@/app/(charter)/actions/policy";
import { getSettings } from "@/app/(charter)/actions/settings";
import { SECTION_STATUS_LABEL, SECTION_STATUS_TONE } from "@/lib/charter/rules";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { ScreenError, SmartEmptyState, Tabs, Textarea } from "../base";
import { Callout, CheckRow } from "../form-kit";
import { ModalProvider, useModal } from "../modal";
import { DiffModal, GenerateDraftModal, PublishVersionModal } from "../modals";
import { useCharterData } from "../use-charter-data";
import PolicyScope from "./policy-scope";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

/** O que a seção passa a exigir na prática, em cada superfície do Charter.
 *  Torna visível que política não é documento — é regra que muda o sistema. */
const DERIVED_RULES: { icon: IconName; t: string; d: string }[] = [
  {
    icon: "inbox",
    t: "Intake de caso de uso",
    d: "Campos obrigatórios e caminho de aprovação recalculados",
  },
  {
    icon: "plug",
    t: "Elegibilidade de fornecedor",
    d: "Classe máxima de dado permitida por fornecedor",
  },
  {
    icon: "userCheck",
    t: "Trilha de onboarding",
    d: "Módulos e aceite revinculados à nova versão",
  },
  {
    icon: "history",
    t: "Trilha de auditoria",
    d: "Diff de campo e aprovador registrados por versão",
  },
];

const VERSION_DISCIPLINE = [
  "Toda publicação exige resumo de mudança — não existe versão sem justificativa.",
  "Aceite de colaborador guarda a versão que ele leu, não apenas a data.",
  "Reabrir seção publicada não altera a versão vigente até nova aprovação.",
  "Exceção concedida expira em 90 dias e volta ao Comitê.",
];

const VERSION_PATTERN = /^v?(\d+)\.(\d+)$/;

function bumpPreview(current: string | null): string {
  if (!current) {
    return "v1.0";
  }
  const m = current.match(VERSION_PATTERN);
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : "v1.0";
}

function PolicyInner() {
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState("sections");
  const [selId, setSelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getPolicy(), [])
  );
  const settings = useCharterData(useCallback(() => getSettings(), []));
  // Só para o modal de publicação dizer quantas trilhas e pessoas serão
  // afetadas pela invalidação de aceites — número inventado ali seria mentira.
  const onboarding = useCharterData(useCallback(() => getOnboarding(), []));
  // Só para alimentar o seletor de exigência (groundedRequirementId) do
  // GenerateDraftModal, em openGenerate.
  const requirementSets = useCharterData(
    useCallback(() => listRequirementSets(), [])
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading) {
    return (
      <div className="fade-in">
        <div className="skeleton" style={{ height: 108, borderRadius: 14 }} />
      </div>
    );
  }
  if (!data) {
    return (
      <SmartEmptyState
        icon="fileText"
        subtitle="Nenhuma política foi criada nesta organização. O seed inicial cria a estrutura de nove seções."
        title="Sem política"
      />
    );
  }

  // Seleção padrão: a primeira seção fora de publicação — é onde o trabalho
  // está. Caindo sempre na S01 o usuário teria de procurar o que falta.
  const firstPending = data.sections.find((s) => s.status !== "PUBLISHED");
  const currentId = selId ?? firstPending?.id ?? data.sections[0]?.id ?? null;
  const sel = data.sections.find((s) => s.id === currentId) ?? null;

  const blockerRows = data.blockers.map((b) => {
    const full = data.sections.find((s) => s.id === b.id);
    return {
      id: b.id,
      ordinal: full?.ordinal ?? 0,
      name: b.name,
      statusLabel: SECTION_STATUS_LABEL[b.status],
      owner: full?.owner ?? null,
    };
  });

  const setStatus = (id: string, status: "PUBLISHED" | "REVIEW" | "DRAFT") =>
    startTransition(async () => {
      const res = await runWithToast(
        () => setSectionStatus({ sectionId: id, status }),
        {
          loading: "Atualizando seção…",
          success:
            status === "PUBLISHED"
              ? "Seção aprovada e publicada"
              : status === "REVIEW"
                ? "Seção enviada para revisão"
                : "Seção devolvida para rascunho",
        }
      );
      if (res.ok) {
        reload();
      }
    });

  const openPublish = () =>
    open(
      <PublishVersionModal
        blockers={blockerRows}
        currentVersion={data.version}
        nextVersion={bumpPreview(data.version)}
        onClose={close}
        onSubmit={(summary) =>
          startTransition(async () => {
            const res = await runWithToast(
              () => publishPolicyVersion({ summary }),
              {
                loading: "Publicando versão…",
                success: (d) =>
                  `${d.version} publicada · ${d.reassignedTracks} trilhas para reatribuir`,
              }
            );
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
        peopleCount={onboarding.data?.coverage.assigned ?? 0}
        policyName={data.name}
        trackCount={onboarding.data?.tracks.length ?? 0}
      />
    );

  const openGenerate = () =>
    open(
      <GenerateDraftModal
        geo={settings.data?.workspace.geo ?? null}
        industry={settings.data?.workspace.industry ?? null}
        onClose={close}
        onSave={(sectionId, body, groundedRequirementId) =>
          startTransition(async () => {
            const res = await runWithToast(
              () =>
                saveGeneratedDraft({
                  sectionId,
                  body,
                  groundedRequirementId,
                }),
              {
                loading: "Salvando rascunho…",
                success: "Rascunho salvo — entra como Rascunho, não publicado",
              }
            );
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
        posture={
          settings.data?.workspace.posture === "CONSERVATIVE"
            ? "Conservadora"
            : settings.data?.workspace.posture === "AGGRESSIVE"
              ? "Permissiva"
              : "Moderada"
        }
        requirementSets={requirementSets.data ?? []}
        sections={data.sections.map((s) => ({
          id: s.id,
          ordinal: s.ordinal,
          name: s.name,
          statusLabel: SECTION_STATUS_LABEL[s.status],
          words: s.words,
        }))}
      />
    );

  const openDiff = (versionId: string) =>
    startTransition(async () => {
      const res = await getVersionDiff(versionId);
      const v = data.versions.find((x) => x.id === versionId);
      if (res.ok && res.data && v) {
        open(
          <DiffModal
            diff={res.data}
            onClose={close}
            publishedAt={v.publishedAt}
            publishedBy={v.publishedBy}
            summary={v.summary}
          />
        );
      }
    });

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={`${data.version ?? "sem versão"}${data.publishedAt ? ` · publicada em ${fmt(data.publishedAt)}` : ""}`}
        meta={
          <>
            <Badge dot tone={data.version ? "green" : "amber"}>
              {data.version ? "Publicada" : "Nunca publicada"}
            </Badge>
            <Badge tone={data.blockers.length ? "amber" : "green"}>
              {data.blockers.length
                ? `${data.blockers.length} seções fora de publicação`
                : "Todas as seções publicadas"}
            </Badge>
            <Badge tone="accent">
              Revisão em {data.daysToReview ?? "—"} dias
            </Badge>
          </>
        }
        subtitle={data.scope ?? undefined}
        title={data.name}
        tone="accent"
      >
        <Button icon="sparkles" onClick={openGenerate} variant="secondary">
          Gerar rascunho
        </Button>
        <span
          style={{
            opacity: data.can.publish ? 1 : 0.45,
            pointerEvents: data.can.publish ? "auto" : "none",
          }}
          title={
            data.can.publish
              ? undefined
              : "Somente o papel Compliance publica versão"
          }
        >
          <Button icon="upload" onClick={openPublish}>
            Publicar versão
          </Button>
        </span>
      </PageHeader>

      <Tabs
        onChange={setTab}
        tabs={[
          { id: "sections", label: "Seções", count: data.sections.length },
          {
            id: "versions",
            label: "Histórico de versões",
            count: data.versions.length,
          },
          { id: "readiness", label: "Prontidão para publicar" },
        ]}
        value={tab}
      />

      {tab === "sections" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "330px 1fr",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          <SectionCard
            bodyStyle={{ padding: 0 }}
            icon="layers"
            subtitle="Cada seção tem dono e ciclo próprio"
            title="Seções"
            tone="accent"
          >
            {data.sections.map((s, i) => {
              const on = s.id === currentId;
              return (
                <button
                  aria-current={on ? "true" : undefined}
                  className="btn navitem"
                  key={s.id}
                  onClick={() => {
                    setSelId(s.id);
                    setEditing(false);
                  }}
                  style={{
                    display: "flex",
                    width: "100%",
                    gap: 11,
                    alignItems: "flex-start",
                    textAlign: "left",
                    padding: "11px 15px",
                    border: "none",
                    borderBottom:
                      i < data.sections.length - 1
                        ? "1px solid var(--hairline)"
                        : "none",
                    borderLeft: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                    background: on ? "var(--accent-soft)" : "transparent",
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: on ? "var(--accent-text)" : "var(--ink-faint)",
                      marginTop: 2,
                    }}
                  >
                    {String(s.ordinal).padStart(2, "0")}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12.5,
                        fontWeight: on ? 700 : 600,
                        color: "var(--ink)",
                        lineHeight: 1.35,
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginTop: 5,
                      }}
                    >
                      <Badge tone={SECTION_STATUS_TONE[s.status]}>
                        {SECTION_STATUS_LABEL[s.status]}
                      </Badge>
                      <span
                        style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
                      >
                        {s.words} palavras · {fmt(s.updatedAt)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </SectionCard>

          {sel && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--gap)",
              }}
            >
              <SectionCard
                action={
                  <Badge dot tone={SECTION_STATUS_TONE[sel.status]}>
                    {SECTION_STATUS_LABEL[sel.status]}
                  </Badge>
                }
                icon="fileText"
                subtitle={`Atualizada em ${fmt(sel.updatedAt)} · ${sel.words} palavras${sel.generated ? " · rascunho assistido" : ""}`}
                title={`${String(sel.ordinal).padStart(2, "0")} · ${sel.name}`}
                tone={SECTION_STATUS_TONE[sel.status]}
              >
                {editing ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <Textarea
                      onChange={(e) => setDraft(e.target.value)}
                      style={{ minHeight: 190, fontSize: 13.5 }}
                      value={draft}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button
                        onClick={() => setEditing(false)}
                        size="sm"
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                      <Button
                        icon="check"
                        onClick={() =>
                          startTransition(async () => {
                            const res = await runWithToast(
                              () =>
                                editSection({
                                  sectionId: sel.id,
                                  body: draft,
                                }),
                              {
                                loading: "Salvando seção…",
                                success: (d) =>
                                  d.status === "REVIEW"
                                    ? "Seção salva e rebaixada para revisão"
                                    : "Seção salva",
                              }
                            );
                            if (res.ok) {
                              setEditing(false);
                              reload();
                            }
                          })
                        }
                        size="sm"
                      >
                        Salvar
                      </Button>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                      Editar uma seção publicada a rebaixa automaticamente para
                      revisão — o texto alterado não é mais o texto aprovado.
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.75,
                        color: "var(--ink)",
                        padding: "4px 2px",
                        textWrap: "pretty",
                      }}
                    >
                      {sel.body}
                    </div>

                    {sel.status !== "PUBLISHED" && (
                      <Callout
                        icon={sel.status === "DRAFT" ? "fileText" : "eye"}
                        style={{ marginTop: 16 }}
                        tone={SECTION_STATUS_TONE[sel.status]}
                      >
                        {sel.status === "DRAFT"
                          ? "Rascunho não publicado: colaboradores não veem esta seção e o onboarding não a cobre. Solicite revisão para entrar na fila de aprovação."
                          : "Em revisão. A versão publicada continua valendo até a aprovação — nenhuma regra muda antes disso."}
                      </Callout>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 9,
                        marginTop: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          opacity: data.can.edit ? 1 : 0.45,
                          pointerEvents: data.can.edit ? "auto" : "none",
                        }}
                        title={
                          data.can.edit
                            ? undefined
                            : "Somente Legal ou Compliance edita seção"
                        }
                      >
                        <Button
                          icon="sliders"
                          onClick={() => {
                            setDraft(sel.body);
                            setEditing(true);
                          }}
                          size="md"
                          variant="secondary"
                        >
                          Editar texto
                        </Button>
                      </span>
                      {sel.status === "DRAFT" && (
                        <Button
                          icon="send"
                          onClick={() => setStatus(sel.id, "REVIEW")}
                          size="md"
                        >
                          Solicitar revisão
                        </Button>
                      )}
                      {sel.status === "REVIEW" && (
                        <>
                          <span
                            style={{
                              opacity: data.can.edit ? 1 : 0.45,
                              pointerEvents: data.can.edit ? "auto" : "none",
                            }}
                            title={
                              data.can.edit
                                ? undefined
                                : "Somente Legal ou Compliance aprova seção"
                            }
                          >
                            <Button
                              icon="check"
                              onClick={() => setStatus(sel.id, "PUBLISHED")}
                              size="md"
                            >
                              Aprovar seção
                            </Button>
                          </span>
                          <Button
                            icon="arrowLeft"
                            onClick={() => setStatus(sel.id, "DRAFT")}
                            size="md"
                            variant="secondary"
                          >
                            Devolver
                          </Button>
                        </>
                      )}
                      {sel.status === "PUBLISHED" && (
                        <Button
                          icon="fileText"
                          onClick={() => setStatus(sel.id, "REVIEW")}
                          size="md"
                          variant="secondary"
                        >
                          Reabrir para revisão
                        </Button>
                      )}
                      <Button
                        icon="history"
                        onClick={() => setTab("versions")}
                        size="md"
                        variant="ghost"
                      >
                        Ver histórico
                      </Button>
                    </div>
                  </>
                )}
              </SectionCard>

              <SectionCard
                icon="shield"
                subtitle="O que a seção passa a exigir na prática, em cada superfície do Charter"
                title="Regras derivadas desta seção"
                tone="blue"
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                    gap: 10,
                  }}
                >
                  {DERIVED_RULES.map((r) => (
                    <div
                      key={r.t}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: "11px 13px",
                        borderRadius: 9,
                        background: "var(--surface-2)",
                        border: "1px solid var(--hairline)",
                      }}
                    >
                      <Icon
                        name={r.icon}
                        size={15}
                        style={{
                          color: "var(--blue-text)",
                          marginTop: 1,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "var(--ink)",
                          }}
                        >
                          {r.t}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--ink-muted)",
                            marginTop: 2,
                            lineHeight: 1.45,
                          }}
                        >
                          {r.d}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      )}

      {tab === "versions" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          <SectionCard
            bodyStyle={{ padding: 0 }}
            icon="history"
            subtitle="Cada publicação guarda aprovador, data e resumo de mudança"
            title="Histórico de versões"
            tone="accent"
          >
            {data.versions.length === 0 ? (
              <SmartEmptyState
                icon="history"
                subtitle="Nenhuma versão foi publicada ainda."
                title="Sem histórico"
              />
            ) : (
              data.versions.map((v, i) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    gap: 13,
                    padding: "15px 16px",
                    borderBottom:
                      i < data.versions.length - 1
                        ? "1px solid var(--hairline)"
                        : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 99,
                        display: "grid",
                        placeItems: "center",
                        background:
                          v.status === "PUBLISHED"
                            ? "var(--green-soft)"
                            : "var(--surface-3)",
                        color:
                          v.status === "PUBLISHED"
                            ? "var(--green-text)"
                            : "var(--ink-faint)",
                        border: `1px solid ${v.status === "PUBLISHED" ? "rgba(var(--green-rgb),.3)" : "var(--hairline)"}`,
                      }}
                    >
                      <Icon
                        name={v.status === "PUBLISHED" ? "check" : "fileText"}
                        size={13}
                        strokeWidth={2.2}
                      />
                    </span>
                    {i < data.versions.length - 1 && (
                      <span
                        style={{
                          flex: 1,
                          width: 1.5,
                          background: "var(--hairline-strong)",
                          marginTop: 5,
                          minHeight: 16,
                        }}
                      />
                    )}
                  </div>
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
                        className="mono"
                        style={{
                          fontSize: 13.5,
                          fontWeight: 800,
                          color: "var(--ink)",
                        }}
                      >
                        {v.version}
                      </span>
                      <Badge
                        tone={v.status === "PUBLISHED" ? "green" : "accent"}
                      >
                        {v.status === "PUBLISHED" ? "Vigente" : "Substituída"}
                      </Badge>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: "var(--ink-faint)" }}
                      >
                        {v.changeCount} seções alteradas
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink-muted)",
                        marginTop: 5,
                        lineHeight: 1.55,
                      }}
                    >
                      {v.summary}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-faint)",
                        marginTop: 5,
                      }}
                    >
                      {fmt(v.publishedAt)}
                    </div>
                  </div>
                  <Button
                    icon="eye"
                    onClick={() => openDiff(v.id)}
                    size="sm"
                    variant="ghost"
                  >
                    Ver diff
                  </Button>
                </div>
              ))
            )}
          </SectionCard>

          <SectionCard
            icon="scale"
            subtitle="Regras que o Charter aplica sozinho"
            title="Disciplina de versão"
            tone="purple"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {VERSION_DISCIPLINE.map((t) => (
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
                      color: "var(--purple-text)",
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
      )}

      {tab === "readiness" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          <SectionCard
            action={
              <Badge tone={data.blockers.length ? "amber" : "green"}>
                {data.sections.length - data.blockers.length}/
                {data.sections.length} prontas
              </Badge>
            }
            icon="shield"
            subtitle="Uma versão só publica com todas as seções aprovadas"
            title="Bloqueios de publicação"
            tone={data.blockers.length ? "amber" : "green"}
          >
            {data.blockers.length === 0 ? (
              <SmartEmptyState
                icon="check"
                onPrimary={openPublish}
                primaryIcon="upload"
                primaryLabel="Publicar versão"
                subtitle="Todas as seções estão aprovadas e a versão pode ser publicada."
                title="Pronta para publicar"
                tone="green"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {blockerRows.map((b) => (
                  <CheckRow
                    checked={false}
                    disabled
                    hint={b.statusLabel}
                    key={b.id}
                    label={`${String(b.ordinal).padStart(2, "0")} · ${b.name}`}
                    right={
                      <Button
                        onClick={() => {
                          setTab("sections");
                          setSelId(b.id);
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        Abrir
                      </Button>
                    }
                    tone="amber"
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon="users"
            subtitle="O que dispara no momento em que a versão sai"
            title="Impacto da publicação"
            tone="accent"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  icon: "userCheck" as IconName,
                  t: "Aceites das trilhas vinculadas são invalidados",
                  d: "Quem aceitou a versão anterior precisa aceitar de novo",
                },
                {
                  icon: "inbox" as IconName,
                  t: "Casos de uso passam a ser lidos pela nova versão",
                  d: "O caminho já firmado em caso submetido não muda",
                },
                {
                  icon: "plug" as IconName,
                  t: "Classe máxima de fornecedor é reavaliada",
                  d: "Cláusulas comparadas à política em vigor",
                },
                {
                  icon: "history" as IconName,
                  t: "Entrada imutável na auditoria",
                  d: "Snapshot das seções, aprovador e timestamp",
                },
              ].map((r) => (
                <div
                  key={r.t}
                  style={{
                    display: "flex",
                    gap: 11,
                    alignItems: "flex-start",
                    padding: "12px 13px",
                    borderRadius: 9,
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <Icon
                    name={r.icon}
                    size={15}
                    style={{
                      color: "var(--accent-text)",
                      marginTop: 1,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--ink)",
                      }}
                    >
                      {r.t}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-muted)",
                        marginTop: 2,
                        lineHeight: 1.45,
                      }}
                    >
                      {r.d}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      <div style={{ marginTop: "var(--gap)" }}>
        <PolicyScope />
      </div>
    </div>
  );
}

export default function PolicyScreen() {
  return (
    <ModalProvider>
      <PolicyInner />
    </ModalProvider>
  );
}
