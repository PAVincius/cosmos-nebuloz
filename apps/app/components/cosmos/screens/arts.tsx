"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
  useNav,
} from "@repo/design-system/cosmos/kit";
// arts.tsx — ARTs (setup do trem e ciclo de vida do PI Plan), story-059.
//
// Esta tela dá superfície à story-017, que foi implementada inteira no backend e
// nunca ganhou UI: createART, createPIPlanWithSprints e transitionPIPlan moram em
// app/actions/arts/lifecycle.ts com 20 casos de teste verdes e, até aqui, zero
// chamadores. ART só nascia por seed ou SQL.
//
// A cadeia que a tela materializa, e que estava partida no primeiro elo:
//   ART → times (em /cosmos/teams) → PI Plan (gera os sprints) → OPEN_PLANNING
// O último passo é o não-óbvio: createPIPlanWithSprints devolve o PI em DRAFT, e
// getActiveProgramBoard só enxerga PLANNING/COMMITTED/EXECUTING. Sem abrir o PI,
// o Program Board fica vazio e o botão de criar Feature nunca aparece — por isso
// o aviso de DRAFT é conteúdo da tela, não detalhe cosmético.
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import type { ArtListView, ArtPiView } from "@/app/(cosmos)/actions/arts";
import { listArts } from "@/app/(cosmos)/actions/arts";
import {
  createART,
  createPIPlanWithSprints,
  transitionPIPlan,
} from "@/app/actions/arts/lifecycle";
import { EmptyState } from "../empty-state";
import {
  ModalCard,
  ModalProvider,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import {
  DirtyProvider,
  FormField,
  MiniSlider,
  Segmented,
  TextInput,
  useDirty,
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

// Medidas de modal-form (campoBase), replicadas porque TextInput não aceita
// type="date" e não há primitiva de data — ver relatório.
const dateInputStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
  padding: "9px 11px",
  width: "100%",
};

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { markDirty } = useDirty();
  return (
    <input
      onChange={(e) => {
        markDirty();
        onChange(e.target.value);
      }}
      style={dateInputStyle}
      type="date"
      value={value}
    />
  );
}

const PI_TONE: Record<string, "neutral" | "accent" | "green" | "amber"> = {
  DRAFT: "neutral",
  PLANNING: "amber",
  COMMITTED: "accent",
  EXECUTING: "green",
  CLOSED: "neutral",
};

// story-059 AC-001 — os defaults são os mesmos de CreateARTSchema. Repetidos
// aqui porque o form precisa de valor inicial; se divergirem, o zod recusa e o
// erro aparece no toast, não silenciosamente.
const CADENCIA_PADRAO = 10;
const SPRINT_PADRAO = 2;

const ART_TONE = "accent";
const PI_MODAL_TONE = "purple";

function NovoArtModal({ onCreated }: { onCreated: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [piCadenceWeeks, setPiCadence] = useState(CADENCIA_PADRAO);
  const [sprintLengthWeeks, setSprintLength] = useState(SPRINT_PADRAO);
  const [ipSprintEnabled, setIpSprint] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const create = async () => {
    if (!name.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createART({
          name: name.trim(),
          piCadenceWeeks,
          sprintLengthWeeks,
          ipSprintEnabled,
        }),
      {
        loading: "Criando ART...",
        success: "ART criado.",
        error: (err: string) =>
          err === "ART_NAME_CONFLICT"
            ? "Já existe um ART com esse nome nesta organização."
            : `Não foi possível criar o ART: ${err}`,
      }
    );
    setSaving(false);
    // Só fecha e recarrega no sucesso: fechar no erro custaria ao usuário o que
    // ele digitou, e recarregar mostraria a mesma lista de antes.
    if (res.ok) {
      close();
      onCreated();
    }
  };

  useModalSubmitShortcut(create, !saving);

  const sprintsPrevistos = Math.floor(piCadenceWeeks / sprintLengthWeeks);

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
                  {saving ? "Criando..." : "Criar ART"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="route" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Um Agile Release Train é o container de execução do PI — a cadência definida aqui gera os sprints de todo time do trem"
        title="Novo ART"
        tone={ART_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${ART_TONE}-rgb),.25)`,
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
                <Icon
                  name="route"
                  size={14}
                  strokeWidth={2}
                  style={{ color: `var(--${ART_TONE}-text)` }}
                />
                <div
                  className="display"
                  style={{ fontSize: 14.5, fontWeight: 700 }}
                >
                  {name || "Nome do ART"}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <Badge tone="neutral">{`PI de ${piCadenceWeeks} semanas`}</Badge>
                <Badge tone="neutral">{`Sprint de ${sprintLengthWeeks}`}</Badge>
              </div>

              <div style={previewLabelStyle}>
                {`Sprints por time (${sprintsPrevistos})`}
              </div>
              {/* A cadência só vira decisão quando se vê o que ela produz: a
                  faixa mostra a última barra como IP quando o IP está ligado. */}
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {Array.from(
                  { length: Math.max(0, sprintsPrevistos) },
                  (_, i) => {
                    const ip = ipSprintEnabled && i === sprintsPrevistos - 1;
                    return (
                      <span
                        key={i}
                        style={{
                          background: ip
                            ? "var(--amber)"
                            : `var(--${ART_TONE}-soft)`,
                          border: `1px solid rgba(var(--${ip ? "amber" : ART_TONE}-rgb),.4)`,
                          borderRadius: 3,
                          flex: 1,
                          height: 22,
                        }}
                      />
                    );
                  }
                )}
              </div>
              <div style={{ color: "var(--ink-muted)", fontSize: 11.5 }}>
                {ipSprintEnabled
                  ? `${sprintsPrevistos - 1} regulares + IP sprint`
                  : `${sprintsPrevistos} regulares`}
              </div>
            </div>
          }
        >
          <FormField label="Nome do ART" required>
            <TextInput
              onChange={setName}
              placeholder="ex: ART Pagamentos"
              required
              value={name}
            />
          </FormField>

          <div>
            <div
              style={{
                color: "var(--ink-subtle)",
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Cadência
            </div>
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <MiniSlider
                label="Cadência do PI (semanas)"
                max={52}
                min={2}
                onChange={setPiCadence}
                value={piCadenceWeeks}
              />
              <MiniSlider
                label="Duração do sprint (semanas)"
                max={4}
                min={1}
                onChange={setSprintLength}
                value={sprintLengthWeeks}
              />
            </div>
          </div>

          <FormField
            hint="A IP sprint é a última do PI — inovação, planejamento e folga de cadência"
            label="IP sprint (Innovation & Planning)"
          >
            <Segmented
              onChange={(v) => {
                setDirty(true);
                setIpSprint(v === "sim");
              }}
              options={[
                { value: "sim", label: "Reservar" },
                { value: "nao", label: "Sem IP" },
              ]}
              tone={ART_TONE}
              value={ipSprintEnabled ? "sim" : "nao"}
            />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

// story-059 AC-003 — uma ação cria o plano e todos os sprints de todos os times
// do ART. O RTE não cria sprint a sprint; a cadência do ART é que manda.
function NovoPiModal({
  art,
  onCreated,
}: {
  art: ArtListView;
  onCreated: () => void;
}) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const create = async () => {
    if (!(name.trim() && startDate) || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createPIPlanWithSprints({
          artId: art.id,
          name: name.trim(),
          // CreatePIPlanWithSprintsSchema exige datetime ISO; o <input type=date>
          // entrega só a data. Forma date-only é interpretada como UTC pelo spec.
          startDate: new Date(startDate).toISOString(),
        }),
      {
        loading: "Criando PI e gerando sprints...",
        success: (data: { sprintCount: number }) =>
          `PI criado com ${data.sprintCount} sprints por time.`,
        error: (err: string) =>
          err === "ART_NO_TEAMS"
            ? "Este ART não tem time vinculado — vincule um time antes."
            : `Não foi possível criar o PI: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onCreated();
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
                  {saving ? "Criando..." : "Criar PI e gerar sprints"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="calendar" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle={`${art.sprintsPorTime} sprints por time serão gerados a partir da cadência do ART`}
        title={`Novo PI em ${art.name}`}
        tone={PI_MODAL_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${PI_MODAL_TONE}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                className="mono"
                style={{
                  color: "var(--ink-faint)",
                  fontSize: 10.5,
                  marginBottom: 10,
                }}
              >
                {art.name}
              </div>
              <div
                className="display"
                style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 10 }}
              >
                {name || "Nome do PI"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <Badge tone={PI_TONE.DRAFT}>DRAFT</Badge>
                <Badge tone="neutral">{`${art.sprintsPorTime} sprints por time`}</Badge>
              </div>

              <div style={previewLabelStyle}>Início</div>
              <div
                style={{
                  color: startDate ? "var(--ink)" : "var(--ink-faint)",
                  fontSize: 12.5,
                  marginBottom: 14,
                }}
              >
                {startDate
                  ? new Date(startDate).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })
                  : "Escolha a data de início do PI"}
              </div>

              {/* O passo que o RTE não adivinha: o PI nasce em DRAFT e some do
                  Program Board até ser aberto. Dizer isso antes de criar é mais
                  barato do que deixá-lo procurar um board vazio. */}
              <div
                style={{
                  background: "var(--amber-soft)",
                  border: "1px solid rgba(var(--amber-rgb),.3)",
                  borderRadius: "var(--r-md)",
                  color: "var(--amber-text)",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  padding: "9px 11px",
                }}
              >
                O PI nasce em DRAFT. Abra-o para planejamento aqui mesmo, ou ele
                não aparece no Program Board.
              </div>
            </div>
          }
        >
          <FormField label="Nome do PI" required>
            <TextInput
              onChange={setName}
              placeholder="ex: PI 2026.1"
              required
              value={name}
            />
          </FormField>
          <FormField
            hint="A partir dela a cadência do ART calcula o fim do PI e as datas de cada sprint"
            label="Início"
            required
          >
            <DateInput onChange={setStartDate} value={startDate} />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

// story-059 AC-004 — DRAFT existe no banco e é invisível para o resto do
// sistema. Sem este aviso, o RTE cria o PI, abre o Program Board, vê vazio e não
// tem como saber que falta um passo.
function PiRow({ pi, onOpened }: { pi: ArtPiView; onOpened: () => void }) {
  const [saving, setSaving] = useState(false);

  const abrir = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => transitionPIPlan({ piPlanId: pi.id, event: "OPEN_PLANNING" }),
      {
        loading: "Abrindo PI para planejamento...",
        success: "PI aberto para planejamento.",
        error: (err: string) => `Não foi possível abrir o PI: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      onOpened();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
          {pi.name}
        </div>
        {!pi.visivelNoBoard && pi.podeAbrir && (
          <div
            style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}
          >
            Em DRAFT, este PI não aparece no Program Board nem recebe features.
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
        {pi.sprintCount} sprints
      </span>
      <Badge tone={PI_TONE[pi.status] ?? "neutral"}>{pi.status}</Badge>
      {pi.podeAbrir && (
        <Button onClick={abrir} size="sm" variant="primary">
          Abrir {pi.name} para planejamento
        </Button>
      )}
    </div>
  );
}

function ArtCard({
  art,
  onChanged,
}: {
  art: ArtListView;
  onChanged: () => void;
}) {
  const modal = useModal();
  const nav = useNav();
  const semTime = art.teamCount === 0;

  return (
    <SectionCard
      action={
        // story-059 AC-002 — a precondição é dita antes do erro. Oferecer o
        // botão num ART vazio seria prometer um ART_NO_TEAMS.
        semTime ? (
          <Button
            onClick={() => nav.navigate("teams")}
            size="sm"
            variant="secondary"
          >
            Vincular times
          </Button>
        ) : (
          <Button
            onClick={() =>
              modal.open(<NovoPiModal art={art} onCreated={onChanged} />)
            }
            size="sm"
            variant="primary"
          >
            Novo PI em {art.name}
          </Button>
        )
      }
      icon="route"
      subtitle={`PI de ${art.piCadenceWeeks} semanas · sprint de ${art.sprintLengthWeeks} · ${art.sprintsPorTime} sprints por time${art.ipSprintEnabled ? " (com IP)" : ""}`}
      title={art.name}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: art.piPlans.length > 0 ? 6 : 0,
        }}
      >
        <Badge tone={art.status === "ACTIVE" ? "green" : "neutral"}>
          {art.status}
        </Badge>
        <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          {art.teamCount} {art.teamCount === 1 ? "time" : "times"}
        </span>
      </div>

      {semTime && (
        <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          Sem time vinculado, este ART não gera PI Plan nem sprints.
        </div>
      )}

      {art.piPlans.map((pi) => (
        <PiRow key={pi.id} onOpened={onChanged} pi={pi} />
      ))}
    </SectionCard>
  );
}

function ArtsBody() {
  const modal = useModal();
  const [arts, setArts] = useState<ArtListView[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listArts();
    if (res.ok) {
      setArts(res.data);
      setErro(null);
    } else {
      // Não zera a lista para null: null é "carregando", e trocar erro por
      // spinner esconderia a falha.
      setArts([]);
      setErro(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="ESSENTIAL"
        subtitle="O trem é o container de execução: sem ART não há PI Plan, e sem PI Plan não há sprint."
        title="ARTs"
      >
        <Button
          onClick={() => modal.open(<NovoArtModal onCreated={load} />)}
          size="sm"
          variant="primary"
        >
          Novo ART
        </Button>
      </PageHeader>

      {erro && <ErrorState message={erro} />}

      {arts === null && !erro && (
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          Carregando...
        </div>
      )}

      {arts !== null && !erro && arts.length === 0 && (
        <EmptyState
          description="O ART é o primeiro passo: dele saem os times, o PI Plan e os sprints."
          icon="route"
          title="Nenhum ART ainda."
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {arts?.map((art) => (
          <ArtCard art={art} key={art.id} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

export default function ArtsScreen() {
  return (
    <ModalProvider>
      <ArtsBody />
    </ModalProvider>
  );
}
