"use client";

// Aba Coleta — US2. Port de `meridian-screens-1.jsx`.

import type { MeridianAxis } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Button,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import {
  assignRespondent,
  closeCollection,
  revokeRespondent,
  sendReminder,
} from "@/app/(meridian)/actions/collection";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Eyebrow,
  Field,
  Input,
  ModalShell,
  SmartEmptyState,
  StatusDot,
  useModal,
} from "../base";
import { ScoreRing } from "../charts";

function AssignRespondentModal({
  assessmentId,
  axis,
  onClose,
  onAssigned,
}: {
  assessmentId: string;
  axis: MeridianAxis;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const valid =
    name.trim().length > 0 && role.trim().length > 0 && email.trim().length > 0;

  const submit = async () => {
    setBusy(true);
    const res = await runWithToast(
      () => assignRespondent({ assessmentId, name, role, email, axis }),
      {
        loading: "Atribuindo respondente…",
        success: `${name} atribuído ao eixo ${AXES[axis].label}.`,
      }
    );
    setBusy(false);
    if (res.ok) {
      setLink(`${window.location.origin}/meridian-responder/${res.data.token}`);
    }
  };

  // `onAssigned` recarrega a lista de respondentes, e a tela de detalhe
  // desmonta pra skeleton enquanto recarrega — se isso rodasse logo depois do
  // `assignRespondent`, o modal com o token (que só aparece uma vez) sumiria
  // antes de o consultor conseguir copiar. Só dispara quando o modal já foi
  // visto e está sendo fechado de propósito.
  const finish = () => {
    onAssigned();
    onClose();
  };

  if (link) {
    return (
      <ModalShell
        footer={
          <Button disabled={!copied} icon="check" onClick={finish}>
            Concluir
          </Button>
        }
        icon="link2"
        onClose={finish}
        subtitle="O token só aparece agora — o banco guarda só o hash. Copie e envie por fora (sem canal automatizado ainda)."
        title="Link de coleta gerado"
        tone="green"
        width={560}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 9,
              alignItems: "center",
              padding: "9px 12px",
              borderRadius: 9,
              border: "1px solid rgba(var(--amber-rgb),.32)",
              background: "var(--amber-soft)",
            }}
          >
            <Icon
              name="alert"
              size={14}
              style={{ color: "var(--amber-text)", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 11.5,
                color: "var(--amber-text)",
                fontWeight: 700,
              }}
            >
              Este link não aparece de novo em lugar nenhum — se sair desta tela
              sem copiar, o único jeito de recuperar é revogar e emitir outro.
            </span>
          </div>
          <Field label={`Link para ${name} · ${AXES[axis].label}`}>
            <div style={{ display: "flex", gap: 8 }}>
              <Input readOnly style={{ flex: 1 }} value={link} />
              <Button
                icon="copy"
                onClick={() => {
                  navigator.clipboard?.writeText(link);
                  setCopied(true);
                }}
                variant="secondary"
              >
                Copiar
              </Button>
            </div>
          </Field>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!valid || busy} icon="check" onClick={submit}>
            Atribuir e gerar link
          </Button>
        </>
      }
      icon="users"
      onClose={onClose}
      subtitle={`Eixo ${AXES[axis].label} — o respondente só enxerga a bateria deste eixo.`}
      title="Atribuir respondente"
      width={520}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 20,
        }}
      >
        <Field label="Nome">
          <Input
            onChange={(e) => setName(e.target.value)}
            placeholder="Marina Costa"
            value={name}
          />
        </Field>
        <Field label="Papel na organização">
          <Input
            onChange={(e) => setRole(e.target.value)}
            placeholder="Gerente de Dados"
            value={role}
          />
        </Field>
        <Field label="E-mail">
          <Input
            onChange={(e) => setEmail(e.target.value)}
            placeholder="marina@empresa.com"
            type="email"
            value={email}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

function RevokeConfirmModal({
  respondentId,
  name,
  onClose,
  onRevoked,
}: {
  respondentId: string;
  name: string;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const res = await runWithToast(() => revokeRespondent({ respondentId }), {
      loading: "Revogando respondente…",
      success: `${name} revogado — o link antigo parou de funcionar.`,
    });
    setBusy(false);
    if (res.ok) {
      onRevoked();
      onClose();
    }
  };

  return (
    <ModalShell
      footer={
        <>
          <Button disabled={busy} onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button
            disabled={busy}
            icon="ban"
            onClick={confirm}
            style={{ background: "var(--red)", borderColor: "var(--red)" }}
          >
            Revogar
          </Button>
        </>
      }
      icon="ban"
      onClose={onClose}
      subtitle={`O link de ${name} para de funcionar na hora — não tem como desfazer.`}
      title="Revogar respondente?"
      tone="red"
      width={440}
    >
      <div style={{ padding: 20, fontSize: 12.5, color: "var(--ink-muted)" }}>
        Se o eixo ainda precisar de dono, atribua outro respondente depois —
        este token não pode ser reativado.
      </div>
    </ModalShell>
  );
}

const R_STATUS: Record<string, [Tone, string]> = {
  INVITED: ["accent", "Convidado"],
  PENDING: ["accent", "Pendente"],
  DONE: ["green", "Concluído"],
  OVERDUE: ["red", "Atrasado"],
  REVOKED: ["neutral", "Revogado"],
};

export default function ColetaTab({
  a,
  onChanged,
}: {
  a: AssessmentDetail;
  onChanged: () => void;
}) {
  const modal = useModal();
  const [busy, setBusy] = useState(false);

  const byAxis = AXIS_IDS.map((axis) => {
    const list = a.respondents.filter((r) => r.axis === axis);
    return {
      axis,
      list,
      active: list.filter((r) => r.status !== "REVOKED"),
    };
  });
  const uncovered = byAxis.filter((b) => b.active.length === 0);
  const progress = a.responses.total
    ? Math.round((a.responses.done / a.responses.total) * 100)
    : 0;

  const remind = async (id: string, name: string) => {
    setBusy(true);
    await runWithToast(() => sendReminder({ respondentId: id }), {
      loading: "Enviando lembrete…",
      success: `${name} recebeu novo lembrete — cessa na conclusão.`,
    });
    setBusy(false);
    onChanged();
  };

  const close = async () => {
    setBusy(true);
    const res = await runWithToast(
      () => closeCollection({ assessmentId: a.id }),
      {
        loading: "Fechando coleta…",
        success: (d) =>
          d.pendingResponses > 0
            ? `Coleta fechada com ${d.pendingResponses} resposta(s) pendente(s) — a confidence dos eixos afetados caiu.`
            : "Coleta fechada · scoring executado.",
      }
    );
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr",
        gap: "var(--gap)",
        alignItems: "start",
      }}
    >
      <SectionCard
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
        icon="users"
        subtitle="Cada um recebe link seguro e só enxerga a sua parte da bateria"
        title="Respondentes por eixo"
      >
        {a.respondents.length === 0 && (
          <SmartEmptyState
            icon="users"
            subtitle="Atribua pelo menos um respondente por eixo para abrir a coleta."
            title="Nenhum respondente atribuído"
            tone="accent"
          />
        )}
        {byAxis.map(({ axis, list, active }) => (
          <div key={axis}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 7,
              }}
            >
              <Icon
                name={AXES[axis as MeridianAxis].icon}
                size={13}
                style={{ color: "var(--ink-faint)" }}
              />
              <Eyebrow>{AXES[axis as MeridianAxis].label}</Eyebrow>
              {active.length === 0 && (
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--red-text)",
                  }}
                >
                  sem dono
                </span>
              )}
              <Button
                icon="plus"
                onClick={() =>
                  modal.open(
                    <AssignRespondentModal
                      assessmentId={a.id}
                      axis={axis}
                      onAssigned={onChanged}
                      onClose={modal.close}
                    />
                  )
                }
                size="sm"
                style={{ marginLeft: "auto" }}
                variant="ghost"
              >
                Atribuir respondente
              </Button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {list.map((r) => {
                const revoked = r.status === "REVOKED";
                const [tone, label] = R_STATUS[r.status] ?? [
                  "accent" as Tone,
                  r.status,
                ];
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 11px",
                      borderRadius: 9,
                      background: "var(--surface-2)",
                      opacity: revoked ? 0.6 : 1,
                      border: `1px solid ${r.status === "OVERDUE" ? "rgba(var(--red-rgb),.35)" : "var(--hairline)"}`,
                    }}
                  >
                    <Avatar name={r.name} size={26} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 700,
                          textDecoration: revoked ? "line-through" : "none",
                        }}
                      >
                        {r.name}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 10.5,
                          color: "var(--ink-faint)",
                          fontWeight: 600,
                        }}
                      >
                        {r.role}
                      </span>
                    </span>
                    <StatusDot label={label} tone={tone} />
                    {!revoked && r.status !== "DONE" && (
                      <Button
                        disabled={busy}
                        icon="mail"
                        onClick={() => remind(r.id, r.name)}
                        size="sm"
                        variant="ghost"
                      >
                        Lembrar
                      </Button>
                    )}
                    {!revoked && (
                      <Button
                        disabled={busy}
                        icon="ban"
                        onClick={() =>
                          modal.open(
                            <RevokeConfirmModal
                              name={r.name}
                              onClose={modal.close}
                              onRevoked={onChanged}
                              respondentId={r.id}
                            />
                          )
                        }
                        size="sm"
                        variant="ghost"
                      >
                        Revogar
                      </Button>
                    )}
                  </div>
                );
              })}
              {active.length === 0 && (
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--red-text)",
                    fontWeight: 600,
                    padding: "4px 2px",
                  }}
                >
                  Eixo sem respondente — o assessment não fecha coleta assim.
                </span>
              )}
            </div>
          </div>
        ))}
      </SectionCard>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
          icon="activity"
          title="Progresso da coleta"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ScoreRing
              label="Progresso"
              size={62}
              tone="accent"
              value={progress}
            />
            <div>
              <div
                className="display"
                style={{ fontSize: 18, fontWeight: 700 }}
              >
                {a.responses.done}{" "}
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-faint)",
                    fontWeight: 600,
                  }}
                >
                  de {a.responses.total} respostas
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                }}
              >
                {a.evidence} evidência(s) anexada(s)
              </div>
            </div>
          </div>

          {uncovered.length > 0 && a.respondents.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 9,
                alignItems: "center",
                padding: "9px 12px",
                borderRadius: 9,
                border: "1px solid rgba(var(--red-rgb),.32)",
                background: "var(--red-soft)",
              }}
            >
              <Icon
                name="alert"
                size={14}
                style={{ color: "var(--red-text)", flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--red-text)",
                  fontWeight: 600,
                }}
              >
                {uncovered
                  .map((u) => AXES[u.axis as MeridianAxis].label)
                  .join(", ")}{" "}
                sem dono — atribua antes de fechar a coleta.
              </span>
            </div>
          )}

          <Button
            disabled={busy || a.status === "FINALISED"}
            icon="check"
            onClick={close}
            size="sm"
            variant="secondary"
          >
            Fechar coleta e rodar scoring
          </Button>
        </SectionCard>

        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 8 }}
          icon="shield"
          title="Como a coleta funciona"
          tone="accent"
        >
          {[
            "Link seguro por respondente — cada um vê só o seu eixo.",
            "Lembretes automáticos param na conclusão.",
            "Evidência anexada vai para armazenamento segregado por organização — nunca no banco relacional.",
            "Todo download de evidência entra na trilha de auditoria.",
          ].map((x) => (
            <span
              key={x}
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                fontWeight: 500,
                lineHeight: 1.55,
              }}
            >
              · {x}
            </span>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
