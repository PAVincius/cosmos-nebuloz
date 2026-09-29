"use client";

// Criar trilha — S-01 (a partir de lacuna promovida) e trilha sem lacuna.
//
// Um form só, duas portas de entrada. `createTrackFromGap` e `createTrack`
// tinham zero chamadores fora de testes: o Meridian dizia "Promovido para o
// SCAFFOLD" e nenhuma trilha nascia. Este modal é o que faltava entre a
// promessa e o trabalho.

import { Button } from "@repo/design-system/cosmos/kit";
import { useEffect, useState } from "react";
import { listTemplates } from "@/app/(scaffold)/actions/templates";
import {
  createTrack,
  createTrackFromGap,
  type PendingPromotion,
  type ScaffoldMember,
} from "@/app/(scaffold)/actions/tracks";
import { workFormLabel } from "@/lib/scaffold/forms";
import { Field, Input, ModalShell, Select } from "./base";

type TemplateOption = { id: string; name: string; archetype: string };

export function NewTrackModal({
  promotion,
  members,
  onClose,
  onCreated,
}: {
  /** Presente quando a trilha nasce de uma lacuna promovida (S-01). */
  promotion: PendingPromotion | null;
  members: ScaffoldMember[];
  onClose: () => void;
  onCreated: (trackId: string) => void;
}) {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  // Nome do processo vem da lacuna quando há uma; a pessoa ajusta se quiser.
  const [processName, setProcessName] = useState(
    promotion ? (promotion.statement.split(":")[0] ?? "").trim() : ""
  );
  const [ownerId, setOwnerId] = useState("");
  const [consultantId, setConsultantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates().then((res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Só template com versão publicada vira trilha — ST-01. Os outros não
      // aparecem em vez de aparecerem desabilitados: não há o que escolher.
      const published = res.data
        .filter((t) => t.currentLabel)
        .map((t) => ({ id: t.id, name: t.name, archetype: t.archetype }));
      setTemplates(published);
      setTemplateId((cur) => cur || (published[0]?.id ?? ""));
    });
  }, []);

  const canSubmit =
    Boolean(templateId) && processName.trim().length > 0 && Boolean(ownerId);

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    const base = {
      templateId,
      processName: processName.trim(),
      ownerId,
      consultantId: consultantId || undefined,
    };
    const res = promotion
      ? await createTrackFromGap({
          ...base,
          gapId: promotion.gapId,
          promotionId: promotion.id,
        })
      : await createTrack(base);
    setBusy(false);
    if (res.ok) {
      onCreated(res.data.trackId);
    } else {
      setError(res.error);
    }
  };

  const consultants = members.filter((m) => m.role === "CONSULTANT");
  // Só quem tem papel de dono do processo: ele produz o que é do dono e assina o
  // caso de negócio. Sponsor, líder do time e consultoria não fazem nenhum dos dois.
  const owners = members.filter((m) => m.role === "PROCESS_OWNER");
  const ownerOptions = [
    {
      value: "",
      label: owners.length
        ? "Escolha o dono do processo"
        : "Ninguém com papel de dono do processo",
    },
    ...owners.map((m) => ({ value: m.id, label: m.name })),
  ];
  const consultantOptions = [
    { value: "", label: "Sem consultor Nebuloz" },
    ...consultants.map((m) => ({ value: m.id, label: m.name })),
  ];
  const templateOptions = (templates ?? []).map((t) => ({
    value: t.id,
    label: `${t.name} · ${workFormLabel(t.archetype)}`,
  }));

  return (
    <ModalShell
      actions={
        <>
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button
            disabled={busy || !canSubmit || !templates}
            icon="layers"
            onClick={submit}
          >
            Criar trilha
          </Button>
        </>
      }
      icon="layers"
      onClose={onClose}
      subtitle={
        promotion
          ? `S-01 · nasce da lacuna ${promotion.gapCode} do Meridian, que continua dona do diagnóstico`
          : "Trilha sem lacuna de origem — nem todo processo passou por diagnóstico"
      }
      title="Nova trilha de adoção"
      tone="accent"
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {promotion ? (
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            {promotion.statement}
          </p>
        ) : null}

        <Field htmlFor="nt-name" label="Processo" required>
          <Input
            autoFocus
            disabled={busy}
            id="nt-name"
            onChange={(e) => setProcessName(e.target.value)}
            placeholder="Ex.: Triagem de autorizações prévias"
            value={processName}
          />
        </Field>

        <Field
          hint={
            templates && templates.length === 0
              ? "Nenhum template tem versão publicada. Publique um na biblioteca antes."
              : undefined
          }
          htmlFor="nt-template"
          label="Template"
          required
        >
          <Select
            id="nt-template"
            onChange={setTemplateId}
            options={
              templateOptions.length
                ? templateOptions
                : [{ value: "", label: templates ? "—" : "Carregando…" }]
            }
            value={templateId}
          />
        </Field>

        <Field
          hint={
            owners.length === 0
              ? "Atribua o papel de dono do processo a alguém em Papéis de adoção antes de criar a trilha."
              : undefined
          }
          htmlFor="nt-owner"
          label="Dono do processo"
          required
        >
          <Select
            id="nt-owner"
            onChange={setOwnerId}
            options={ownerOptions}
            value={ownerId}
          />
        </Field>

        <Field htmlFor="nt-consultant" label="Consultor Nebuloz">
          <Select
            id="nt-consultant"
            onChange={setConsultantId}
            options={consultantOptions}
            value={consultantId}
          />
        </Field>

        {error ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--red-text)",
            }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
