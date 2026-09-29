"use client";

// Detalhe da trilha — S-04, S-02/S-03, SG-05, SG-06.
// Port de `scaffold-screens-2.jsx`.
//
// A tela é o estado e as ações; o desenho mora nos irmãos: `phase-stepper`
// (o trilho de fases e gates), `step-list` (os passos da fase), `gate-panel`
// (a decisão do gate) e `phase-cards` (observação, Charter, handover).

import {
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listDeliverables } from "@/app/(scaffold)/actions/deliverables";
import { exportHandoverPack } from "@/app/(scaffold)/actions/export";
import {
  acknowledgeCharterPolicy,
  closePhase,
  overridePhase,
  reopenPhase,
} from "@/app/(scaffold)/actions/gates";
import {
  attachArtefact,
  readArtefact,
  setStepState,
} from "@/app/(scaffold)/actions/steps";
import {
  cancelTrack,
  getTrack,
  type TrackDetail,
} from "@/app/(scaffold)/actions/tracks";
import { phaseGateState } from "@/lib/scaffold/deliverable-machine";
import { PHASE, PHASE_STATE } from "@/lib/scaffold/phases";
import {
  Eyebrow,
  Field,
  MetaCell,
  ModalShell,
  ScreenError,
  Select,
  SkeletonCard,
  SmartEmptyState,
  StatusDot,
  Textarea,
} from "../base";
import { type DeliverableItem, DeliverableList } from "../deliverable-list";
import { type CriterionFacts, type GateNotice, GatePanel } from "../gate-panel";
import {
  CharterPolicyCard,
  HandoverCard,
  ObservationCard,
} from "../phase-cards";
import { PhaseStepper } from "../phase-stepper";
import { StepList } from "../step-list";

/** Os três atos que rescrevem o histórico de uma trilha, e por isso pedem
 *  justificativa. O texto mora aqui, e não em ternários no JSX, para que os
 *  três se leiam lado a lado. */
const MODAL_COPY = {
  override: {
    icon: "shield",
    tone: "amber",
    title: "Override do gate",
    subtitle:
      "SG-03 · fica no histórico do gate, com nome e justificativa, para sempre",
    cta: "Registrar override e fechar",
    placeholder:
      "Por que o critério pode ser dispensado nesta trilha, e o que cobre o risco que ele media.",
  },
  reopen: {
    icon: "refresh",
    tone: "red",
    title: "Reabrir",
    subtitle:
      "SG-06 · reabrir zera a janela de observação e invalida a entrega",
    cta: "Reabrir fase",
    placeholder:
      "O que voltou a não valer, e o que precisa ser refeito antes de fechar de novo.",
  },
  cancel: {
    icon: "x",
    tone: "red",
    title: "Cancelar trilha",
    subtitle:
      "A trilha sai do portfólio. O que já foi registrado — gates, overrides, artefatos — fica.",
    cta: "Cancelar trilha",
    placeholder:
      "Por que este processo não segue. Quem lê a auditoria daqui a um ano precisa entender sem perguntar.",
  },
} as const;

export default function TrackDetailScreen({ param }: { param?: string }) {
  const router = useRouter();
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gateNotice, setGateNotice] = useState<GateNotice | null>(null);
  // Um modal por vez: override pede a lista do que foi dispensado; reabrir
  // pede só a justificativa. Os dois escrevem no histórico do gate.
  const [modal, setModal] = useState<
    | { kind: "override"; unmet: string[] }
    | { kind: "reopen" }
    | { kind: "cancel" }
    | null
  >(null);
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [rationale, setRationale] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  // Cancelar trilha com caso assinado obriga a dizer o que o Signal faz com a
  // apuração — sem decisão, o servidor recusa (TRACK_HAS_SIGNED_BUSINESS_CASE).
  const [signalDecision, setSignalDecision] = useState<
    "keep_reading" | "stop_reading"
  >("stop_reading");
  // A fase ativa muda com o clique no stepper; o callback de aceite é criado
  // antes dela ser resolvida, então o id viaja por ref.
  const activePhaseId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!param) {
      return;
    }
    setError(null);
    const [res, dels] = await Promise.all([
      getTrack({ trackId: param }),
      listDeliverables({ trackId: param }),
    ]);
    if (res.ok) {
      setTrack(res.data);
      setPhase((p) => p ?? res.data.currentPhase);
      // Falha ao ler entregáveis não derruba a trilha: a tela cai na regra de
      // passos e o servidor continua sendo quem decide o fechamento.
      setDeliverables(dels.ok ? dels.data : []);
    } else {
      setError(res.error);
    }
  }, [param]);

  useEffect(() => {
    load();
  }, [load]);

  const ackPolicy = useCallback(
    async (policyId: string) => {
      if (!activePhaseId.current) {
        return;
      }
      const res = await acknowledgeCharterPolicy({
        phaseInstanceId: activePhaseId.current,
        policyId,
      });
      if (res.ok) {
        await load();
      } else {
        setError(res.error);
      }
    },
    [load]
  );

  const exportHandover = useCallback(async () => {
    if (!param) {
      return;
    }
    setBusy(true);
    const res = await exportHandoverPack({ trackId: param });
    setBusy(false);
    if (res.ok) {
      // Abre em aba nova: a URL é assinada e de curta duração, e navegar a
      // página atual para um download deixaria o usuário sem para onde voltar.
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error);
    }
  }, [param]);

  const toggleStep = useCallback(
    async (stepId: string, next: "DONE" | "TODO") => {
      const res = await setStepState({ stepInstanceId: stepId, state: next });
      if (res.ok) {
        await load();
      } else {
        setError(res.error);
      }
    },
    [load]
  );

  // Recusa de regra (tem `code`) fica no painel do gate; falha de servidor
  // derruba a tela como qualquer outra.
  const gateRefused = useCallback(
    (res: { error: string; code?: string; blockers?: string[] }) => {
      if (res.code) {
        setGateNotice({ message: res.error, blockers: res.blockers ?? [] });
        return true;
      }
      setError(res.error);
      return false;
    },
    []
  );

  const closeGate = useCallback(
    async (facts: CriterionFacts) => {
      if (!(activePhaseId.current && track)) {
        return;
      }
      setBusy(true);
      const res = await closePhase({
        phaseInstanceId: activePhaseId.current,
        // Quem assina o gate é o dono do processo — é a posse nomeada que o
        // override precisa para valer alguma coisa. Um seletor de aprovador
        // entra quando houver caso real de outra pessoa assinar.
        approverId: track.ownerId,
        criteriaFacts: facts,
      });
      setBusy(false);
      if (res.ok) {
        setGateNotice(null);
      } else {
        gateRefused(res);
      }
      // Recarrega nos dois casos: SG-02 move a fase para BLOCKED mesmo
      // recusando, e o painel precisa refletir isso para oferecer o override.
      await load();
    },
    [load, track, gateRefused]
  );

  const openModal = useCallback((m: NonNullable<typeof modal>) => {
    setRationale("");
    setModalError(null);
    setModal(m);
  }, []);

  const submitModal = useCallback(async () => {
    if (!(activePhaseId.current && modal && param)) {
      return;
    }
    setBusy(true);
    let res: { ok: boolean; error?: string };
    if (modal.kind === "override") {
      res = await overridePhase({
        phaseInstanceId: activePhaseId.current,
        unmetCriteria: modal.unmet,
        rationale,
      });
    } else if (modal.kind === "reopen") {
      res = await reopenPhase({
        phaseInstanceId: activePhaseId.current,
        rationale,
      });
    } else {
      res = await cancelTrack({
        trackId: param,
        rationale,
        signalDecision: track?.businessCase?.signed
          ? signalDecision
          : undefined,
      });
    }
    setBusy(false);
    if (res.ok) {
      setModal(null);
      setGateNotice(null);
      if (modal.kind === "cancel") {
        router.push("/scaffold/portfolio");
        return;
      }
      await load();
      return;
    }
    // Recusa fica no modal: a pessoa está no meio de escrever a justificativa
    // e fechar o modal por cima dela jogaria o texto fora.
    setModalError(res.error ?? "Erro inesperado");
  }, [load, modal, rationale, param, track, signalDecision, router]);

  const attach = useCallback(
    async (stepId: string, file: File) => {
      setBusy(true);
      const res = await attachArtefact({
        stepInstanceId: stepId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
      // A URL é assinada para PUT direto no storage: o byte não passa pelo
      // servidor da aplicação.
      const put = await fetch(res.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      setBusy(false);
      if (!put.ok) {
        setError(
          `Upload falhou (${put.status}). O registro do artefato existe; tente anexar de novo.`
        );
        return;
      }
      await load();
    },
    [load]
  );

  const open = useCallback(async (artefactId: string) => {
    const res = await readArtefact({ artefactId });
    if (res.ok) {
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error);
    }
  }, []);

  const selectPhase = useCallback((p: string) => {
    setGateNotice(null);
    setPhase(p);
  }, []);

  if (!param) {
    return (
      <SmartEmptyState
        icon="search"
        onPrimary={() => router.push("/scaffold/portfolio")}
        primaryIcon="arrowLeft"
        primaryLabel="Voltar ao portfólio"
        subtitle="Abra uma trilha a partir do portfólio."
        title="Nenhuma trilha selecionada"
        tone="accent"
      />
    );
  }
  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }
  if (!track) {
    return <SkeletonCard />;
  }

  const activePhase =
    track.phases.find((p) => p.phase === phase) ?? track.phases[0];
  if (!activePhase) {
    return <SkeletonCard />;
  }
  activePhaseId.current = activePhase.id;
  const editable =
    activePhase.state === "OPEN" ||
    activePhase.state === "GATE_READY" ||
    activePhase.state === "BLOCKED";

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow={track.templateName}
        meta={
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <StatusDot
              label={PHASE_STATE[activePhase.state].label}
              tone={PHASE_STATE[activePhase.state].tone}
            />
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-faint)" }}
            >
              {track.code} · {track.templateLabel} · início{" "}
              {track.startedAt.toLocaleDateString("pt-BR")}
            </span>
          </div>
        }
        subtitle={
          track.sourceGap
            ? `Semeada da lacuna ${track.sourceGap.code} do Meridian: “${track.sourceGap.statement}”`
            : "Trilha criada sem lacuna de origem."
        }
        title={track.processName}
      >
        <Button
          icon="arrowLeft"
          onClick={() => router.push("/scaffold/portfolio")}
          variant="secondary"
        >
          Portfólio
        </Button>
        {track.status === "ACTIVE" || track.status === "STALLED" ? (
          <Button
            disabled={busy}
            icon="x"
            onClick={() => openModal({ kind: "cancel" })}
            variant="secondary"
          >
            Cancelar trilha
          </Button>
        ) : null}
      </PageHeader>

      <PhaseStepper
        activePhase={activePhase.phase}
        onSelect={selectPhase}
        track={track}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            icon="fileText"
            subtitle="SG-01 · o gate só fecha com todo obrigatório aprovado"
            title={`Entregáveis — ${PHASE[activePhase.phase].label}`}
            tone="accent"
          >
            <DeliverableList
              items={deliverables.filter(
                (d) => d.phaseInstanceId === activePhase.id
              )}
              onChanged={load}
            />
          </SectionCard>
          <SectionCard
            icon="check"
            subtitle="S-04 · cada passo produz um artefato esperado"
            title={`Passos — ${PHASE[activePhase.phase].label}`}
            tone="accent"
          >
            <StepList
              editable={editable}
              onAttach={attach}
              onOpen={open}
              onToggle={toggleStep}
              phase={activePhase}
            />
          </SectionCard>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <GatePanel
            busy={busy}
            closeBlockedReason={
              phaseGateState(
                deliverables,
                activePhase.id,
                Boolean(track.businessCase?.signed)
              ).reason
            }
            // Trocar de fase zera o que foi marcado: os critérios são outros.
            key={activePhase.id}
            notice={gateNotice}
            onClose={closeGate}
            onOverride={(unmet) => openModal({ kind: "override", unmet })}
            onReopen={() => openModal({ kind: "reopen" })}
            phase={activePhase}
          />
          <CharterPolicyCard
            busy={busy}
            onAck={ackPolicy}
            phase={activePhase}
          />
          <HandoverCard
            busy={busy}
            onExport={exportHandover}
            phase={activePhase}
            track={track}
          />
          <ObservationCard phase={activePhase} />
          <SectionCard
            icon="users"
            subtitle="posse nomeada em cada papel"
            title="Quem responde"
            tone="neutral"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <MetaCell
                label="Dono do processo"
                value={track.ownerName ?? "—"}
              />
              <MetaCell
                label="Consultor Nebuloz"
                value={track.consultantName ?? "não atribuído"}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      {modal ? (
        <ModalShell
          actions={
            <>
              <Button
                disabled={busy}
                onClick={() => setModal(null)}
                variant="secondary"
              >
                Voltar
              </Button>
              <Button
                disabled={busy || rationale.trim().length < 20}
                icon={MODAL_COPY[modal.kind].icon}
                onClick={submitModal}
              >
                {MODAL_COPY[modal.kind].cta}
              </Button>
            </>
          }
          icon={MODAL_COPY[modal.kind].icon}
          onClose={() => setModal(null)}
          subtitle={MODAL_COPY[modal.kind].subtitle}
          title={`${MODAL_COPY[modal.kind].title} — ${
            modal.kind === "cancel"
              ? track.code
              : PHASE[activePhase.phase].label
          }`}
          tone={MODAL_COPY[modal.kind].tone}
          width={560}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {modal.kind === "cancel" && track.businessCase?.signed ? (
              <Field
                hint="Há caso de negócio assinado. O Signal precisa saber se continua apurando contra ele."
                htmlFor="cancel-signal"
                label="Apuração do Signal"
                required
              >
                <Select
                  id="cancel-signal"
                  onChange={setSignalDecision}
                  options={[
                    {
                      value: "stop_reading",
                      label: "Parar de apurar — a promessa morre com a trilha",
                    },
                    {
                      value: "keep_reading",
                      label: "Seguir apurando — a promessa sobrevive à trilha",
                    },
                  ]}
                  value={signalDecision}
                />
              </Field>
            ) : null}
            {modal.kind === "override" ? (
              <div>
                <Eyebrow style={{ marginBottom: 6 }}>
                  Critérios que serão dispensados
                </Eyebrow>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: "var(--ink)",
                  }}
                >
                  {modal.unmet.map((k) => (
                    <li key={k}>
                      {activePhase.criteria.find((c) => c.key === k)
                        ?.statement ?? k}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Field
              error={modalError ?? undefined}
              hint="Mínimo de 20 caracteres. “ok” e “urgente” não são justificativa — são gate desligado."
              htmlFor="gate-rationale"
              label="Justificativa"
              required
            >
              <Textarea
                autoFocus
                disabled={busy}
                id="gate-rationale"
                invalid={Boolean(modalError)}
                onChange={(e) => setRationale(e.target.value)}
                placeholder={MODAL_COPY[modal.kind].placeholder}
                value={rationale}
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
