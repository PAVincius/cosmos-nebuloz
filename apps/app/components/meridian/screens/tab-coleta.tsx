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
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import {
  assignRespondent,
  closeCollection,
  reissuePendingLinks,
  reissueRespondentLink,
  revokeRespondent,
  sendReminder,
} from "@/app/(meridian)/actions/collection";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { respondentLink } from "@/lib/meridian/respondent-link";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Eyebrow,
  Field,
  Input,
  ModalShell,
  SmartEmptyState,
  StatusDot,
  useDirty,
  useModal,
} from "../base";
import { ScoreRing } from "../charts";
import { EvidenceList } from "./evidence-list";

/**
 * Guarda de fechamento: enquanto `guarded`, marca o `ModalHost` como sujo
 * (backdrop/Esc do Charter caem na confirmação de descarte genérica) e
 * intercepta o Esc em fase de captura no `document` — antes do listener em
 * `window` do `ModalHost` — pra abrir a confirmação PRÓPRIA deste modal em
 * vez da genérica. Nasceu do P1 AS-112 (5fad9132): X/Esc/backdrop fechando
 * sem copiar o link perdiam o token do mesmo jeito que "Concluir" desabilitado
 * tentava evitar.
 */
function useCloseGuard(guarded: boolean) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { markDirty } = useDirty();

  useEffect(() => {
    if (guarded) {
      markDirty();
    }
  }, [guarded, markDirty]);

  const requestClose = (doClose: () => void) => {
    if (guarded) {
      setConfirmDiscard(true);
      return;
    }
    doClose();
  };

  // Esc via `onKeyDownCapture` (fase de captura do React, escopada ao DOM
  // deste modal) chega antes do listener em `window` (bolha) que o
  // `ModalHost` usa — sem isso, Esc fecha e perde o link/lista mesmo com
  // "Concluir" desabilitado. `stopPropagation` no evento sintético propaga
  // pro nativo, então a bolha nunca chega em `window`. Via prop de React em
  // vez de `document.addEventListener` manual: limpeza garantida no
  // unmount, sem risco de vazar listener entre montagens de teste.
  const handleKeyDownCapture = (e: KeyboardEvent) => {
    if (guarded && e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      setConfirmDiscard(true);
    }
  };

  return {
    confirmDiscard,
    setConfirmDiscard,
    requestClose,
    handleKeyDownCapture,
  };
}

function DiscardConfirmOverlay({
  title,
  message,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 320,
        display: "grid",
        placeItems: "center",
        background: "var(--scrim)",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        aria-labelledby="discard-link-title"
        aria-modal="true"
        role="alertdialog"
        style={{
          background: "var(--surface-3)",
          border: "1px solid var(--hairline-strong)",
          borderRadius: "var(--r-lg)",
          padding: "24px 28px",
          maxWidth: 400,
          boxShadow: "0 24px 48px -16px rgba(0,0,0,.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 11,
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 9,
              flexShrink: 0,
              background: "var(--amber-soft)",
              color: "var(--amber-text)",
              border: "1px solid rgba(var(--amber-rgb),.25)",
            }}
          >
            <Icon name="alert" size={16} />
          </span>
          <div>
            <div
              className="display"
              id="discard-link-title"
              style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 5 }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-muted)",
                lineHeight: 1.55,
              }}
            >
              {message}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={onCancel} size="md" variant="secondary">
            Voltar e copiar
          </Button>
          <Button
            icon="x"
            onClick={onConfirm}
            size="md"
            style={{ background: "var(--red)", borderColor: "var(--red)" }}
          >
            Fechar mesmo assim
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Exibe um link de respondente que só aparece uma vez (banco guarda só o
 * hash) — usado tanto por "Atribuir respondente" quanto por "Reemitir link"
 * (mesmo padrão, texto de título/aviso diferente).
 */
function RespondentLinkModal({
  title,
  fieldLabel,
  link,
  discardMessage,
  onClose,
  onDone,
}: {
  title: string;
  fieldLabel: string;
  link: string;
  discardMessage: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const {
    confirmDiscard,
    setConfirmDiscard,
    requestClose,
    handleKeyDownCapture,
  } = useCloseGuard(!copied);

  const finish = () => {
    onDone();
    onClose();
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard indisponível");
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      // Sem Clipboard API (ou negada): seleciona o texto pra Ctrl+C manual
      // funcionar. O `onCopy` do input marca `copied` quando isso acontecer.
      linkInputRef.current?.select();
      setCopyFailed(true);
    }
  };

  return (
    <div
      onKeyDownCapture={handleKeyDownCapture}
      style={{ display: "contents" }}
    >
      <ModalShell
        footer={
          <Button disabled={!copied} icon="check" onClick={finish}>
            Concluir
          </Button>
        }
        icon="link2"
        onClose={() => requestClose(finish)}
        subtitle="O token só aparece agora — o banco guarda só o hash. Copie e envie por fora (sem canal automatizado ainda)."
        title={title}
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
              sem copiar, o único jeito de recuperar é reemitir de novo.
            </span>
          </div>
          <Field label={fieldLabel}>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                onCopy={() => setCopied(true)}
                readOnly
                ref={linkInputRef}
                style={{ flex: 1 }}
                value={link}
              />
              <Button icon="copy" onClick={copyLink} variant="secondary">
                Copiar
              </Button>
            </div>
          </Field>
          {copyFailed && (
            <span
              style={{
                fontSize: 11,
                color: "var(--red-text)",
                fontWeight: 600,
              }}
            >
              Não deu pra copiar automático — o texto já está selecionado, use
              Ctrl+C (ou Cmd+C) pra copiar à mão.
            </span>
          )}
        </div>
      </ModalShell>
      {confirmDiscard && (
        <DiscardConfirmOverlay
          message={discardMessage}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={finish}
          title="Fechar sem copiar o link?"
        />
      )}
    </div>
  );
}

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
  const modal = useModal();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

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
    if (!res.ok) {
      return;
    }
    // Troca pro modal de link — não é a mesma tela recarregando: `onAssigned`
    // só dispara quando o consultor fecha esse modal de propósito, senão o
    // link (que só aparece uma vez) some antes de dar tempo de copiar.
    modal.open(
      <RespondentLinkModal
        discardMessage={`Você não copiou o link de ${name}. Ele não aparece de novo — o único jeito de recuperar depois é revogar esse respondente e emitir outro.`}
        fieldLabel={`Link para ${name} · ${AXES[axis].label}`}
        link={respondentLink(window.location.origin, res.data.token)}
        onClose={modal.close}
        onDone={onAssigned}
        title="Link de coleta gerado"
      />
    );
  };

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

type ReissuedItem = {
  respondentId: string;
  name: string;
  axis: MeridianAxis;
  link: string;
};

/** Tira \n/\r de um campo de texto — impede linha falsa injetada via nome
 *  (Vigia, item 2) tanto no `.txt`/clipboard quanto no `.csv`. */
function stripLineBreaks(v: string): string {
  return v.replaceAll(/[\r\n]+/g, " ");
}

/** "nome · eixo · link", um por linha — mesmo texto pro clipboard e pro
 *  `.txt`. Exportada pra testar o formato sem montar clipboard/DOM. */
export function buildReissuedListText(items: ReissuedItem[]): string {
  return items
    .map(
      (i) => `${stripLineBreaks(i.name)} · ${AXES[i.axis].label} · ${i.link}`
    )
    .join("\n");
}

/** Mesmo conteúdo em CSV (`nome,eixo,link`), campos entre aspas — o link é
 *  uma URL e não deveria ter vírgula, mas aspas cobrem o caso mesmo assim.
 *  Nome/eixo levam apóstrofo na frente quando começam com =, +, -, @ ou TAB —
 *  sem isso o Excel/Sheets interpreta o campo como fórmula ao abrir o .csv
 *  (Vigia, item 1: HYPERLINK/WEBSERVICE pode exfiltrar o token da linha). */
const CSV_FORMULA_PREFIX = /^[=+\-@\t]/;

function csvTextField(v: string): string {
  const noBreaks = stripLineBreaks(v);
  const neutralized = CSV_FORMULA_PREFIX.test(noBreaks)
    ? `'${noBreaks}`
    : noBreaks;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

export function buildReissuedListCsv(items: ReissuedItem[]): string {
  const quoteLink = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const header = "nome,eixo,link";
  const rows = items.map((i) =>
    [
      csvTextField(i.name),
      csvTextField(AXES[i.axis].label),
      quoteLink(i.link),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lista dos links reemitidos em lote (spec 006 US2) — nasce pronta do
 * servidor a cada acionamento (não guarda token em claro no estado do
 * cliente entre reloads, decisão do CPO em research.md). Mesma guarda de
 * fechamento do link individual: perder a lista sem copiar/baixar repetiria
 * o incidente de origem (3 tropeços com os mesmos 10 links, atrito.md).
 */
function ReissuedListModal({
  items,
  onClose,
  onDone,
}: {
  items: ReissuedItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [secured, setSecured] = useState(false);
  const {
    confirmDiscard,
    setConfirmDiscard,
    requestClose,
    handleKeyDownCapture,
  } = useCloseGuard(!secured);

  const finish = () => {
    onDone();
    onClose();
  };

  const text = buildReissuedListText(items);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setSecured(true);
    } catch {
      // Sem Clipboard API: quem ainda quiser levar a lista usa "baixar" —
      // não tem input único pra selecionar aqui, ao contrário do link solo.
    }
  };

  const download = (ext: "txt" | "csv") => {
    const content = ext === "csv" ? buildReissuedListCsv(items) : text;
    downloadFile(
      `meridian-reemissao-${Date.now()}.${ext}`,
      content,
      ext === "csv" ? "text/csv" : "text/plain"
    );
    setSecured(true);
  };

  return (
    <div
      onKeyDownCapture={handleKeyDownCapture}
      style={{ display: "contents" }}
    >
      <ModalShell
        footer={
          <Button disabled={!secured} icon="check" onClick={finish}>
            Concluir
          </Button>
        }
        icon="refresh"
        onClose={() => requestClose(finish)}
        subtitle={`${items.length} link(s) reemitido(s) — os tokens só aparecem agora. Copie ou baixe antes de fechar.`}
        title="Links reemitidos"
        tone="green"
        width={640}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon="copy" onClick={copyAll} variant="secondary">
              Copiar tudo
            </Button>
            <Button
              icon="download"
              onClick={() => download("txt")}
              variant="secondary"
            >
              Baixar .txt
            </Button>
            <Button
              icon="download"
              onClick={() => download("csv")}
              variant="secondary"
            >
              Baixar .csv
            </Button>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {items.map((i) => (
              <div
                key={i.respondentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 9px",
                  borderRadius: 8,
                  background: "var(--surface-2)",
                }}
              >
                <span
                  style={{ fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}
                >
                  {i.name} · {AXES[i.axis].label}
                </span>
                <Input
                  readOnly
                  style={{ flex: 1, fontSize: 11 }}
                  value={i.link}
                />
              </div>
            ))}
          </div>
        </div>
      </ModalShell>
      {confirmDiscard && (
        <DiscardConfirmOverlay
          message={`Você não copiou nem baixou a lista com ${items.length} link(s) reemitido(s). Ela some ao fechar — reabrir e acionar de novo gera tokens novos.`}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={finish}
          title="Fechar sem copiar ou baixar a lista?"
        />
      )}
    </div>
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

  // Reemite o link do MESMO respondente (spec 006, US1) — o remédio pro AS-112:
  // link perdido antes de copiar não precisa de revogar + reatribuir.
  const reissueOne = async (id: string, name: string, axis: MeridianAxis) => {
    setBusy(true);
    const res = await runWithToast(
      () => reissueRespondentLink({ respondentId: id }),
      {
        loading: "Reemitindo link…",
        success: `Link novo gerado para ${name}.`,
      }
    );
    setBusy(false);
    if (!res.ok) {
      return;
    }
    modal.open(
      <RespondentLinkModal
        discardMessage={`Você não copiou o link reemitido de ${name}. Ele não aparece de novo — o único jeito de recuperar depois é reemitir de novo.`}
        fieldLabel={`Link para ${name} · ${AXES[axis].label}`}
        link={respondentLink(window.location.origin, res.data.token)}
        onClose={modal.close}
        onDone={onChanged}
        title="Link reemitido"
      />
    );
  };

  // Reemite em lote todo pendente do assessment (spec 006, US2) — o remédio
  // pro cenário real do incidente (10 links perdidos de uma vez).
  const reissueAll = async () => {
    setBusy(true);
    const res = await runWithToast(
      () => reissuePendingLinks({ assessmentId: a.id }),
      {
        loading: "Reemitindo links pendentes…",
        success: (d) =>
          d.reissued.length > 0
            ? `${d.reissued.length} link(s) reemitido(s).`
            : "Nenhum respondente pendente pra reemitir.",
      }
    );
    setBusy(false);
    // Lista vazia não é falha (FR-013) — só não há o que mostrar/copiar.
    if (!res.ok || res.data.reissued.length === 0) {
      return;
    }
    modal.open(
      <ReissuedListModal
        items={res.data.reissued.map((r) => ({
          respondentId: r.respondentId,
          name: r.name,
          axis: r.axis,
          link: respondentLink(window.location.origin, r.token),
        }))}
        onClose={modal.close}
        onDone={onChanged}
      />
    );
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
        action={
          <Button
            disabled={busy}
            icon="refresh"
            onClick={reissueAll}
            size="sm"
            variant="ghost"
          >
            Reemitir e copiar todos os pendentes
          </Button>
        }
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
                    {!revoked && r.status !== "DONE" && (
                      <Button
                        disabled={busy}
                        icon="refresh"
                        onClick={() =>
                          reissueOne(r.id, r.name, r.axis as MeridianAxis)
                        }
                        size="sm"
                        variant="ghost"
                      >
                        Reemitir link
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
            <div style={{ minWidth: 0 }}>
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
                <EvidenceList assessmentId={a.id} total={a.evidence} />
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
