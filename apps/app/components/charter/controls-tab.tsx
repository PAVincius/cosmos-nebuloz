"use client";

// Aba Controles do caso — CH-DEV-04.
//
// Mostra o plano de controles do caso: progresso "X/Y com evidência aceita", o
// que bloqueia a decisão, filtros e, por controle, estado + validade. Os
// controles vêm do perfil da forma de trabalho filtrados pela classe de dado;
// o que ficou de fora é contado e dito ("N controles não se aplicam à classe
// X"). Estado nunca vai só na cor: rótulo ao lado do ponto.

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useMemo, useState } from "react";
import type {
  CaseControlsView,
  CaseControlView,
} from "@/app/(charter)/actions/controls-read";
import {
  CONTROL_STATE_META,
  filterControls,
  progressLabel,
} from "@/lib/charter/controls-view";
import {
  type ChipOption,
  Eyebrow,
  FilterChips,
  GatedButton,
  SmartEmptyState,
  StatusDot,
  TableHead,
  TableRow,
} from "./base";
import { useModal } from "./modal";
import { AddControlModal } from "./modals/add-control";
import { ControlModal } from "./modals/control";
import { ProcessCard } from "./process-card";
import { FS } from "./type-scale";

const COLS = "72px minmax(0,2.2fr) 110px 100px 130px 110px";

const STATE_CHIPS: ChipOption[] = (
  Object.keys(CONTROL_STATE_META) as (keyof typeof CONTROL_STATE_META)[]
).map((s) => ({
  id: s,
  label: CONTROL_STATE_META[s].label,
  tone: CONTROL_STATE_META[s].tone,
}));

const BLOCKING_ID = "__blocking";

function validity(c: CaseControlView): string {
  if (c.state === "DISPENSED" && c.dispensedUntil) {
    return `até ${c.dispensedUntil.toLocaleDateString("pt-BR")}`;
  }
  if (c.expiresAt) {
    return c.expiresAt.toLocaleDateString("pt-BR");
  }
  return "—";
}

function ControlRow({
  c,
  last,
  onOpen,
}: {
  c: CaseControlView;
  last: boolean;
  onOpen: () => void;
}) {
  const meta = CONTROL_STATE_META[c.state as keyof typeof CONTROL_STATE_META];
  return (
    <TableRow
      cols={COLS}
      label={`Abrir ${c.code} · ${c.name}`}
      last={last}
      onClick={onOpen}
    >
      <span className="mono" style={{ fontSize: FS.nota, fontWeight: 700 }}>
        {c.code}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: FS.base, fontWeight: 600 }}>{c.name}</span>
        <span
          style={{
            display: "block",
            fontSize: FS.nota,
            color: "var(--ink-faint)",
          }}
        >
          {c.categoryLabel}
          {c.isExtra ? " · adicionado ao caso" : ""}
        </span>
      </span>
      <span style={{ fontSize: FS.nota, color: "var(--ink-muted)" }}>
        {c.roleLabel}
      </span>
      <span style={{ fontSize: FS.nota, color: "var(--ink-muted)" }}>
        {c.cadenceLabel}
      </span>
      <span>
        <StatusDot label={meta.label} tone={meta.tone} />
        {c.blocksDecision ? (
          <span
            style={{
              display: "block",
              fontSize: FS.micro,
              color: "var(--red-text)",
            }}
          >
            bloqueia a decisão
          </span>
        ) : null}
      </span>
      <span className="mono" style={{ fontSize: FS.nota }}>
        {validity(c)}
      </span>
    </TableRow>
  );
}

export function ControlsTab({
  data,
  onChanged,
}: {
  data: CaseControlsView;
  onChanged: () => void;
}) {
  const { open } = useModal();
  const [filter, setFilter] = useState("all");

  const rows = useMemo(
    () =>
      filterControls(data.controls, {
        state: filter === "all" || filter === BLOCKING_ID ? undefined : filter,
        blocking: filter === BLOCKING_ID,
      }),
    [data.controls, filter]
  );

  const blockingCount = data.blockers.length;
  const options: ChipOption[] = [
    ...(blockingCount > 0
      ? [
          {
            id: BLOCKING_ID,
            label: "Bloqueiam a decisão",
            tone: "red" as const,
            count: blockingCount,
          },
        ]
      : []),
    ...STATE_CHIPS,
  ];

  const openControl = (c: CaseControlView) =>
    open(
      <ControlModal
        can={data.can}
        caseCode={data.caseCode}
        control={c}
        onChanged={onChanged}
      />
    );
  const openAdd = () =>
    open(
      <AddControlModal
        addable={data.addable}
        caseCode={data.caseCode}
        onChanged={onChanged}
      />
    );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <SectionCard
        action={
          <GatedButton
            allowed={data.can.submit}
            icon="plus"
            onClick={openAdd}
            reason="Só quem submete o caso adiciona controle."
            variant="secondary"
          >
            Adicionar controle
          </GatedButton>
        }
        subtitle={
          data.profile
            ? `Perfil ${data.profile.name} · ${data.profile.versionLabel} · classe de dado ${data.dataClassLabel}`
            : `Classe de dado ${data.dataClassLabel}`
        }
        title="Plano de controles"
      >
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div>
            <Eyebrow>Progresso</Eyebrow>
            <div
              className="mono"
              style={{ fontSize: FS.forte, fontWeight: 700 }}
            >
              {data.controls.length === 0
                ? "—"
                : progressLabel(data.progress.accepted, data.progress.total)}
            </div>
          </div>
          <div>
            <Eyebrow>Decisão</Eyebrow>
            <div
              style={{
                fontSize: FS.base,
                fontWeight: 600,
                color: blockingCount > 0 ? "var(--red-text)" : "var(--ink)",
              }}
            >
              {blockingCount > 0
                ? `${blockingCount} controle(s) bloqueiam aprovar`
                : "Nenhum controle bloqueia aprovar"}
            </div>
          </div>
        </div>
        {data.notApplicable.label ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: FS.nota,
              color: "var(--ink-muted)",
            }}
          >
            {data.notApplicable.label}: {data.notApplicable.codes.join(", ")}.
          </p>
        ) : null}
      </SectionCard>

      {data.controls.length === 0 ? (
        <SmartEmptyState
          icon="shield"
          subtitle="O plano nasce do perfil da forma de trabalho, filtrado pela classe de dado. Sem plano, nada além da decisão comum bloqueia a aprovação."
          title="Este caso ainda não tem plano de controles"
          tone="accent"
        />
      ) : (
        <>
          <FilterChips
            allLabel="Todos"
            ariaLabel="Filtrar controles"
            onChange={setFilter}
            options={options}
            value={filter}
          />
          <SectionCard
            title={`${rows.length} de ${data.controls.length} controles`}
          >
            <TableHead
              cols={COLS}
              labels={[
                "Código",
                "Controle",
                "Papel",
                "Cadência",
                "Estado",
                "Validade",
              ]}
            />
            {rows.map((c, i) => (
              <ControlRow
                c={c}
                key={c.code}
                last={i === rows.length - 1}
                onOpen={() => openControl(c)}
              />
            ))}
          </SectionCard>
        </>
      )}

      <ProcessCard process={data.process} />
    </div>
  );
}
