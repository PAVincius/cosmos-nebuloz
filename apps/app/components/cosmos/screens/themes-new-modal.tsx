"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, Button, useAction } from "@repo/design-system/cosmos/kit";
// themes-new-modal.tsx — NewThemeModal, separado de themes.tsx pelo
// file-size-guard (teto de 800 linhas, scripts/file-size-guard.mts).
// Conteúdo movido como estava.
import { type CSSProperties, useState } from "react";
import {
  createTheme,
  listThemeLinkOptions,
  type ThemeLinkOptions,
} from "@/app/(cosmos)/actions/themes";
import {
  ModalCard,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import {
  DirtyProvider,
  EntityLinkField,
  FormField,
  TextArea,
  TextInput,
  TonePicker,
} from "../modal-form";
import { useActionToast } from "../use-action-toast";

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

export function NewThemeModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("purple");
  const [target, setTarget] = useState("15");
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [epicIds, setEpicIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // Budgets e épicos vinculáveis. Carrega uma vez, ao abrir: os dois campos
  // de busca compartilham a mesma viagem.
  const { data: opcoes } = useAction<ThemeLinkOptions>(
    () => listThemeLinkOptions(),
    []
  );

  const budgets = opcoes?.budgets ?? [];
  const epics = opcoes?.epics ?? [];
  const budget = budgets.find((b) => b.id === budgetId);
  const alvo = Number(target) || 0;
  // Quanto do lean budget do portfólio esta aposta consome, comparado ao que
  // ela deveria consumir — é a pergunta que o tema existe para responder.
  const totalPortfolio = opcoes?.budgetTotalPortfolio ?? 0;
  const alocado =
    budget && totalPortfolio > 0
      ? Math.round(((budget.amount ?? 0) / totalPortfolio) * 100)
      : 0;
  const desvio = alocado - alvo;

  const create = async () => {
    if (!title.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createTheme({
          title: title.trim(),
          description: description.trim() || undefined,
          tone: tone as
            | "accent"
            | "blue"
            | "purple"
            | "green"
            | "amber"
            | "red",
          ...(target.trim() ? { targetAllocationPct: alvo } : {}),
          ...(budgetId ? { leanBudgetId: budgetId } : {}),
          ...(epicIds.length > 0 ? { epicIds } : {}),
        }),
      {
        loading: "Criando tema estratégico...",
        success: "Tema estratégico criado.",
        error: (err: string) => `Não foi possível criar o tema: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onCreated?.();
    }
  };

  useModalSubmitShortcut(create, !saving);

  return (
    <DirtyProvider value={{ markDirty: () => setDirty(true) }}>
      <ModalCard
        footer={
          confirmandoSaida ? (
            <>
              <span style={{ color: "var(--ink-subtle)", fontSize: 12.5 }}>
                Descartar o que você preencheu?
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => setConfirmandoSaida(false)}
                  size="sm"
                  variant="secondary"
                >
                  Continuar editando
                </Button>
                <Button onClick={close} size="sm" variant="secondary">
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <>
              <ModalShortcutHint salvar="criar" />
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => {
                    // Confirma só quando há o que perder.
                    if (dirty) {
                      setConfirmandoSaida(true);
                      return;
                    }
                    close();
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  icon="check"
                  onClick={create}
                  size="sm"
                  variant="primary"
                >
                  {saving ? "Criando..." : "Criar tema"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="target" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Aposta de investimento do portfólio — vinculada a um budget aprovado e aos épicos que a compõem"
        title="Novo Tema Estratégico"
        tone={tone}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${tone}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    background: `var(--${tone})`,
                    borderRadius: 99,
                    height: 10,
                    width: 10,
                  }}
                />
                <div
                  className="display"
                  style={{ fontSize: 14.5, fontWeight: 700 }}
                >
                  {title || "Nome do tema"}
                </div>
              </div>
              <div
                style={{
                  color: "var(--ink-muted)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  marginBottom: 14,
                }}
              >
                {description || "Descrição da aposta estratégica..."}
              </div>

              <div style={previewLabelStyle}>Budget alocado</div>
              {budget ? (
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {budget.label}
                  </span>
                  <Badge tone="neutral">{budget.sub}</Badge>
                </div>
              ) : (
                <div
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  Nenhum budget vinculado ainda
                </div>
              )}

              <div
                style={{
                  color: "var(--ink-faint)",
                  display: "flex",
                  fontSize: 11,
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span>{`Alocado ~${alocado}%`}</span>
                <span>{`Alvo ${alvo}%`}</span>
              </div>
              <div
                style={{
                  background: "var(--surface-3)",
                  borderRadius: 99,
                  height: 6,
                  marginBottom: 8,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    background: `var(--${tone})`,
                    height: "100%",
                    width: `${Math.min(100, alocado)}%`,
                  }}
                />
                {/* Marca do alvo: sem ela a barra diz "quanto", nunca "quanto
                    a mais ou a menos". */}
                <div
                  style={{
                    background: "var(--ink)",
                    height: 10,
                    left: `${Math.min(100, alvo)}%`,
                    position: "absolute",
                    top: -2,
                    width: 2,
                  }}
                />
              </div>
              <div
                style={{
                  color:
                    Math.abs(desvio) > 5
                      ? "var(--amber-text)"
                      : "var(--ink-faint)",
                  fontSize: 11,
                  marginBottom: 14,
                }}
              >
                {budget
                  ? Math.abs(desvio) > 5
                    ? `⚠ desvio de ${desvio > 0 ? "+" : ""}${desvio}pp do alvo`
                    : "Dentro da faixa alvo"
                  : "Vincule um budget para calcular o desvio"}
              </div>

              <div style={previewLabelStyle}>
                {`Épicos vinculados (${epicIds.length})`}
              </div>
              {epicIds.length === 0 ? (
                <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                  Nenhum épico vinculado ainda
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {epicIds.map((id) => (
                    <div key={id} style={{ color: "var(--ink)", fontSize: 12 }}>
                      {`· ${epics.find((x) => x.id === id)?.label ?? id}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
        >
          <FormField label="Nome do tema" required>
            <TextInput
              onChange={setTitle}
              placeholder="ex: Modernização da Plataforma"
              required
              value={title}
            />
          </FormField>
          <FormField label="Descrição">
            <TextArea
              onChange={setDescription}
              placeholder="O que esta aposta estratégica entrega, e por quê"
              rows={3}
              value={description}
            />
          </FormField>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <FormField label="Cor / tone">
              <TonePicker onChange={setTone} value={tone} />
            </FormField>
            <FormField label="Alvo de orçamento (%)">
              <TextInput onChange={setTarget} type="number" value={target} />
            </FormField>
          </div>

          <EntityLinkField
            hint="Aloca o investimento deste tema a um Value Stream existente"
            items={budgets}
            label="Budget / Value Stream"
            onChange={(v) => setBudgetId(v as string | null)}
            placeholder="Buscar um budget já aprovado..."
            tone={tone}
            value={budgetId}
          />

          <EntityLinkField
            hint="Épicos que compõem este tema — só aparecem os que ainda não têm tema"
            items={epics}
            label="Épicos"
            multi
            onChange={(v) => setEpicIds((v as string[]) ?? [])}
            placeholder="Buscar épicos existentes..."
            tone={tone}
            value={epicIds}
          />
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}
