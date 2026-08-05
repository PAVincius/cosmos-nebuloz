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
import { useCallback, useEffect, useState } from "react";
import type { ArtListView, ArtPiView } from "@/app/(cosmos)/actions/arts";
import { listArts } from "@/app/(cosmos)/actions/arts";
import {
  createART,
  createPIPlanWithSprints,
  transitionPIPlan,
} from "@/app/actions/arts/lifecycle";
import { EmptyState } from "../empty-state";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
} as const;

const labelStyle = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
} as const;

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

function NovoArtModal({ onCreated }: { onCreated: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [piCadenceWeeks, setPiCadence] = useState(CADENCIA_PADRAO);
  const [sprintLengthWeeks, setSprintLength] = useState(SPRINT_PADRAO);
  const [ipSprintEnabled, setIpSprint] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const sprintsPrevistos = Math.floor(piCadenceWeeks / sprintLengthWeeks);

  return (
    <ModalCard
      icon={<Icon name="route" size={16} strokeWidth={2.4} />}
      subtitle="Um Agile Release Train é o container de execução do PI"
      title="Novo ART"
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="art-name" style={labelStyle}>
            Nome do ART
          </label>
          <input
            autoFocus
            id="art-name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                create();
              }
            }}
            placeholder="Ex: ART Pagamentos"
            style={inputStyle}
            value={name}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="art-cadence" style={labelStyle}>
              Cadência do PI (semanas)
            </label>
            <input
              id="art-cadence"
              max={52}
              min={2}
              onChange={(e) => setPiCadence(Number(e.target.value))}
              style={inputStyle}
              type="number"
              value={piCadenceWeeks}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="art-sprint" style={labelStyle}>
              Duração do sprint (semanas)
            </label>
            <input
              id="art-sprint"
              max={4}
              min={1}
              onChange={(e) => setSprintLength(Number(e.target.value))}
              style={inputStyle}
              type="number"
              value={sprintLengthWeeks}
            />
          </div>
        </div>

        <label
          htmlFor="art-ip"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-subtle)",
          }}
        >
          <input
            checked={ipSprintEnabled}
            id="art-ip"
            onChange={(e) => setIpSprint(e.target.checked)}
            type="checkbox"
          />
          Reservar IP sprint (Innovation &amp; Planning)
        </label>

        <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          Cada PI deste ART gerará {sprintsPrevistos} sprints por time
          {ipSprintEnabled
            ? ` (${sprintsPrevistos - 1} regulares + IP sprint).`
            : " regulares."}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar ART
          </Button>
        </div>
      </div>
    </ModalCard>
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

  return (
    <ModalCard
      icon={<Icon name="calendar" size={16} strokeWidth={2.4} />}
      subtitle={`${art.sprintsPorTime} sprints por time serão gerados a partir da cadência do ART`}
      title={`Novo PI em ${art.name}`}
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="pi-name" style={labelStyle}>
            Nome do PI
          </label>
          <input
            autoFocus
            id="pi-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: PI 2026.1"
            style={inputStyle}
            value={name}
          />
        </div>
        <div>
          <label htmlFor="pi-start" style={labelStyle}>
            Início
          </label>
          <input
            id="pi-start"
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
            type="date"
            value={startDate}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar PI e gerar sprints
          </Button>
        </div>
      </div>
    </ModalCard>
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
