"use client";

// Modal do controle — CH-DEV-04. Evidência que conta, o que a evidência mostra,
// responsável, papel, arquivo, histórico com os comentários, edição e o aviso
// quando a evidência venceu. O texto do controle é a cópia do perfil no momento
// em que o plano nasceu: publicar versão nova do perfil não reescreve o que o
// caso já cumpre.

import type { CaseControlView } from "@/app/(charter)/actions/controls-read";
import { CONTROL_STATE_META, expiryWarning } from "@/lib/charter/controls-view";
import { Eyebrow, MetaCell, StatusDot } from "../base";
import { Callout } from "../form-kit";
import { ModalShell, useModal } from "../modal";
import { FS } from "../type-scale";
import { ControlActions } from "./control-actions";

const ACTION_LABEL: Record<string, string> = {
  START: "Plano gerado",
  ATTACH: "Evidência anexada",
  SUBMIT: "Enviada para revisão",
  ACCEPT: "Aceita",
  REQUEST_ADJUSTMENT: "Ajuste pedido",
  DISPENSE: "Dispensado",
  REOPEN: "Reaberto",
  EXPIRE: "Vencida",
  EDIT: "Editada",
};

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ marginTop: 4, fontSize: FS.base, lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

export function ControlModal({
  caseCode,
  control,
  can,
  onChanged,
}: {
  caseCode: string;
  control: CaseControlView;
  can: { submit: boolean; decide: boolean };
  onChanged: () => void;
}) {
  const { close } = useModal();
  const meta =
    CONTROL_STATE_META[control.state as keyof typeof CONTROL_STATE_META];
  const warning = expiryWarning(control, new Date());

  return (
    <ModalShell
      icon="shield"
      onClose={close}
      subtitle={<StatusDot label={meta.label} tone={meta.tone} />}
      title={`${control.code} · ${control.name}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {warning ? (
          <Callout icon="alert" tone={warning.tone}>
            {warning.text}
          </Callout>
        ) : null}
        {control.blocksDecision ? (
          <Callout icon="ban" tone="red">
            Este controle bloqueia a decisão de aprovar o caso enquanto não
            tiver evidência aceita ou dispensa com prazo.
          </Callout>
        ) : null}

        <Block title="Evidência que conta">{control.evidence}</Block>
        {control.acceptanceCriteria ? (
          <Block title="Critério de aceite">{control.acceptanceCriteria}</Block>
        ) : null}
        <Block title="O que a evidência mostra">
          {control.summary ?? "Nada anexado ainda."}
          {control.fileName ? (
            <span
              className="mono"
              style={{ display: "block", fontSize: FS.nota }}
            >
              Arquivo: {control.fileName}
            </span>
          ) : null}
        </Block>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          <MetaCell label="Responsável" value={control.ownerName ?? "—"} />
          <MetaCell label="Papel que revisa" value={control.roleLabel} />
          <MetaCell label="Cadência" value={control.cadenceLabel} />
          <MetaCell label="Classe mínima" value={control.minClassLabel} />
          <MetaCell
            label="Produzida em"
            mono
            value={fmt(control.evidenceProducedAt)}
          />
          <MetaCell label="Aceita em" mono value={fmt(control.acceptedAt)} />
          <MetaCell label="Vence em" mono value={fmt(control.expiresAt)} />
          <MetaCell
            label="Mitigação ligada"
            mono
            value={control.mitigation?.code ?? "—"}
          />
        </div>
        {control.state === "DISPENSED" ? (
          <Block title="Dispensa">
            {control.dispensedReason ?? "—"}{" "}
            <span className="mono">até {fmt(control.dispensedUntil)}</span>
          </Block>
        ) : null}

        <ControlActions
          can={can}
          caseCode={caseCode}
          control={control}
          onDone={() => {
            close();
            onChanged();
          }}
        />

        <div>
          <Eyebrow>Histórico e comentários</Eyebrow>
          {control.events.map((e) => (
            <div
              key={e.id}
              style={{
                padding: "8px 0",
                borderBottom: "1px dashed var(--hairline)",
                fontSize: FS.base,
              }}
            >
              <strong>{ACTION_LABEL[e.action] ?? e.action}</strong>{" "}
              <span
                className="mono"
                style={{ color: "var(--ink-faint)", fontSize: FS.nota }}
              >
                · {e.actor} · {e.at.toLocaleDateString("pt-BR")}
              </span>
              {e.comment ? (
                <div style={{ marginTop: 3, color: "var(--ink-muted)" }}>
                  {e.comment}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
