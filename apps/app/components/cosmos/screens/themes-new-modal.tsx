"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, Button, useAction } from "@repo/design-system/cosmos/kit";
// themes-new-modal.tsx — NewThemeModal, separado de themes.tsx pelo
// file-size-guard (teto de 800 linhas, scripts/file-size-guard.mts).
// Conteúdo movido como estava — inclusive o quick-create de budget e épico
// (#113/#114), que uma extração anterior deste arquivo (#112, cortada de
// main antes desse trabalho) tinha deixado de fora. Regride quem reintroduz
// a versão antiga aqui: a fonte de verdade passou a ser este arquivo, não
// mais um bloco dentro de themes.tsx.
import { type CSSProperties, useState } from "react";
import { createEpic } from "@/app/(cosmos)/actions/kanban";
import {
  createTheme,
  listThemeLinkOptions,
  type ThemeLinkOption,
  type ThemeLinkOptions,
} from "@/app/(cosmos)/actions/themes";
import { createLeanBudget } from "@/app/actions/lean-budget";
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

  // Budget criado aqui dentro não volta em listThemeLinkOptions: aquela lista
  // foi carregada uma vez, ao abrir. Sem guardá-lo, o preview diria "nenhum
  // budget vinculado" logo depois de vincular um.
  const [budgetsCriados, setBudgetsCriados] = useState<ThemeLinkOption[]>([]);
  const budgets = [...budgetsCriados, ...(opcoes?.budgets ?? [])];
  // Mesmo motivo do budget: épico criado aqui dentro não está em
  // opcoes.epics (carregada uma vez, ao abrir) — sem isto o preview mostrava
  // o id cru na lista de "épicos vinculados" em vez do título digitado.
  const [epicsCriados, setEpicsCriados] = useState<ThemeLinkOption[]>([]);
  const epics = [...epicsCriados, ...(opcoes?.epics ?? [])];
  const budget = budgets.find((b) => b.id === budgetId);
  const alvo = Number(target) || 0;
  // Quanto do lean budget do portfólio esta aposta consome, comparado ao que
  // ela deveria consumir — é a pergunta que o tema existe para responder.
  // O denominador soma os budgets recém-criados: eles também são portfólio, e
  // deixá-los de fora inflaria a fatia deste tema.
  const totalPortfolio =
    (opcoes?.budgetTotalPortfolio ?? 0) +
    budgetsCriados.reduce((soma, b) => soma + (b.amount ?? 0), 0);
  const alocado =
    budget && totalPortfolio > 0
      ? Math.round(((budget.amount ?? 0) / totalPortfolio) * 100)
      : 0;
  const desvio = alocado - alvo;

  // Criar o épico sem sair daqui: exigir abrir o Kanban para cadastrá-lo antes
  // custaria tudo o que já foi preenchido neste formulário.
  const criarEpico = async (rascunho: Record<string, string>) => {
    const titulo = (rascunho.title ?? "").trim();
    if (!titulo) {
      return null;
    }
    // "funnel" é onde épico novo nasce no fluxo SAFe; a coluna não é escolha
    // do formulário compacto.
    const res = await createEpic({ title: titulo, column: "funnel" });
    if (!res.ok) {
      return null;
    }
    // A action devolve só o id — o rótulo do chip vem do que foi digitado.
    // "sub" vazio: sem o épico recém-criado ter status nem WSJF ainda, não
    // há linha de apoio honesta a mostrar no dropdown.
    const novo = { id: res.data.id, label: titulo, sub: "" };
    setEpicsCriados((atuais) => [novo, ...atuais]);
    return { id: novo.id, label: novo.label };
  };

  // Mesmo motivo do épico: um tema sem budget aprovado é caixa de texto, e o
  // budget é justamente o que costuma faltar na hora de criar o tema.
  const criarBudget = async (rascunho: Record<string, string>) => {
    const nome = (rascunho.name ?? "").trim();
    const periodo = (rascunho.period ?? "").trim();
    const valor = Number(rascunho.amount);
    // O schema do servidor recusaria do mesmo jeito; barrar aqui devolve o
    // formulário aberto sem gastar a viagem.
    if (!(nome && periodo && Number.isFinite(valor) && valor > 0)) {
      return null;
    }
    const res = await createLeanBudget({
      amount: valor,
      name: nome,
      period: periodo,
    });
    if (!res.ok) {
      return null;
    }
    const novo = {
      amount: valor,
      id: res.data.id,
      label: res.data.name,
      sub: periodo,
    };
    setBudgetsCriados((atuais) => [novo, ...atuais]);
    return novo;
  };

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
            quickCreate={{
              campos: [
                {
                  key: "name",
                  label: "Nome do budget",
                  placeholder: "ex: Plataforma",
                },
                {
                  key: "amount",
                  label: "Valor (R$)",
                  placeholder: "1000000",
                  type: "number",
                },
                {
                  key: "period",
                  label: "Período",
                  placeholder: "ex: PI-2026-Q1",
                },
              ],
              inicial: { amount: "", name: "", period: "" },
              label: "+ Criar novo budget",
              onCreate: criarBudget,
            }}
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
            quickCreate={{
              campos: [
                {
                  key: "title",
                  label: "Título do épico",
                  placeholder: "ex: Antifraude",
                },
              ],
              inicial: { title: "" },
              label: "+ Criar novo épico",
              onCreate: criarEpico,
            }}
            tone={tone}
            value={epicIds}
          />
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}
