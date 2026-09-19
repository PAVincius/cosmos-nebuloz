"use client";

// modals/publish-track.tsx — PublishTrackModal (FR-10.4). Movido de
// modals.tsx no split em um arquivo por modal; anatomia preservada 1:1
// (ModalSplit com prévia da trilha à direita).

import { Icon } from "@repo/design-system/cosmos/icons";
import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { TRACK_AUDIENCES } from "@/lib/charter/rules";
import { Eyebrow, GatedButton, MetaCell } from "../base";
import {
  CheckRow,
  FooterHint,
  FormField,
  Kbd,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from "../form-kit";
import { ModalShell, ModalSplit } from "../modal";
import { FS } from "../type-scale";

// ── 10. PublishTrackModal (FR-10.4) ───────────────────────────────────────────

export function PublishTrackModal({
  sections,
  policyVersion,
  onClose,
  onSubmit,
  pending,
}: {
  sections: {
    id: string;
    ordinal: number;
    name: string;
    status: string;
    statusLabel: string;
    words: number;
  }[];
  policyVersion: string | null;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    audience: string;
    modules: number;
    minutes: number;
    recert: "ANNUAL" | "SEMIANNUAL";
    people: { name: string; department?: string }[];
    dueInDays: number;
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<string>(TRACK_AUDIENCES[0]);
  const [recert, setRecert] = useState("Anual");
  const [picked, setPicked] = useState<string[]>([]);
  const [quiz, setQuiz] = useState(true);
  const [roster, setRoster] = useState("");

  const toggle = (id: string) =>
    setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const minutes = picked.length * 6 + (quiz ? 5 : 0);
  const people = roster
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [n, dept] = l.split(",").map((s) => s.trim());
      return { name: n, department: dept || undefined };
    });
  // Motivo do gate como texto no rodapé; null quando está pronto.
  const gateReason =
    name.trim().length > 3 && picked.length > 0
      ? null
      : "Informe o nome e escolha ao menos uma seção publicada";

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar ·{" "}
            {gateReason ?? `Aceite registra a versão ${policyVersion ?? "—"}`}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedButton
              allowed={gateReason === null && !pending}
              icon="send"
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  audience,
                  modules: picked.length,
                  minutes,
                  recert: recert === "Anual" ? "ANNUAL" : "SEMIANNUAL",
                  people,
                  dueInDays: 14,
                })
              }
              reason={gateReason ?? ""}
            >
              {pending ? "Publicando…" : "Publicar e atribuir"}
            </GatedButton>
          </div>
        </>
      }
      icon="plus"
      onClose={onClose}
      subtitle="A trilha é montada a partir de seções publicadas da política"
      title="Publicar trilha de onboarding"
      tone="green"
      width={860}
    >
      <ModalSplit
        aside={
          <>
            <Eyebrow tone="green">Prévia da trilha</Eyebrow>
            <div
              style={{
                padding: "14px 15px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
              }}
            >
              <div
                style={{
                  fontSize: FS.base,
                  fontWeight: 700,
                  color: "var(--ink)",
                  lineHeight: 1.35,
                }}
              >
                {name || "Nova trilha"}
              </div>
              <div
                style={{
                  fontSize: FS.nota,
                  color: "var(--ink-muted)",
                  marginTop: 4,
                }}
              >
                {audience}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 13,
                }}
              >
                <MetaCell label="Módulos" mono value={String(picked.length)} />
                <MetaCell label="Duração" mono value={`${minutes} min`} />
              </div>
              <div
                style={{
                  marginTop: 13,
                  paddingTop: 13,
                  borderTop: "1px solid var(--hairline)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                }}
              >
                {picked.map((id) => {
                  const s = sections.find((x) => x.id === id);
                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        gap: 8,
                        fontSize: FS.nota,
                        color: "var(--ink-muted)",
                      }}
                    >
                      <span
                        className="mono"
                        style={{ color: "var(--green-text)", fontWeight: 700 }}
                      >
                        {String(s?.ordinal ?? 0).padStart(2, "0")}
                      </span>
                      {s?.name}
                    </div>
                  );
                })}
                {quiz && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: FS.nota,
                      color: "var(--green-text)",
                      fontWeight: 700,
                    }}
                  >
                    <Icon name="check" size={13} />
                    Quiz e aceite formal
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
              }}
            >
              <Eyebrow style={{ marginBottom: 7 }}>Alcance</Eyebrow>
              <div
                className="mono"
                style={{
                  fontSize: FS.display,
                  fontWeight: 800,
                  color: "var(--ink)",
                  lineHeight: 1,
                }}
              >
                {people.length}
              </div>
              <div
                style={{
                  fontSize: FS.nota,
                  color: "var(--ink-muted)",
                  marginTop: 4,
                }}
              >
                pessoas recebem o pedido de aceite
              </div>
            </div>
          </>
        }
        asideWidth={290}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <FormField label="Nome da trilha" required>
            <TextInput
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Uso de IA generativa no atendimento"
              value={name}
            />
          </FormField>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField label="Público" required>
              <Select
                onChange={(e) => setAudience(e.target.value)}
                options={[...TRACK_AUDIENCES]}
                value={audience}
              />
            </FormField>
            <FormField label="Re-certificação" required variant="group">
              <Segmented
                full
                onChange={setRecert}
                options={[{ value: "Anual" }, { value: "Semestral" }]}
                value={recert}
              />
            </FormField>
          </div>
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>
              Seções que compõem a trilha · somente publicadas
            </Eyebrow>
            <div
              className="scroll"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {sections.map((s) => {
                const publishable = s.status === "PUBLISHED";
                return (
                  <CheckRow
                    checked={picked.includes(s.id)}
                    disabled={!publishable}
                    hint={
                      publishable
                        ? `${s.words} palavras · ~6 min`
                        : `${s.statusLabel} — não pode entrar em trilha`
                    }
                    key={s.id}
                    label={`${String(s.ordinal).padStart(2, "0")} · ${s.name}`}
                    onToggle={() => toggle(s.id)}
                    tone="green"
                  />
                );
              })}
            </div>
          </div>
          <FormField
            hint="Uma pessoa por linha, no formato: Nome, Área"
            label="Pessoas atribuídas"
          >
            <TextArea
              onChange={(e) => setRoster(e.target.value)}
              placeholder={"Marina Alves, Compliance\nDiego Prado, Segurança"}
              rows={5}
              value={roster}
            />
          </FormField>
          <div
            style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}
          >
            <CheckRow
              checked={quiz}
              hint="Sem aceite formal, não há evidência de comunicação da política"
              label="Exigir quiz e aceite formal"
              onToggle={() => setQuiz((v) => !v)}
              tone="green"
            />
          </div>
        </div>
      </ModalSplit>
    </ModalShell>
  );
}
