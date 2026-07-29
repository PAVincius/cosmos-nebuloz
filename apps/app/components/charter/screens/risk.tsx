"use client";

// Matriz de Risco — FR-7. Heatmap 5×5 clicável que filtra a lista abaixo.

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { createMitigation, getRiskBoard } from "@/app/(charter)/actions/risk";
import {
  RISK_CATEGORY_DESC,
  RISK_CATEGORY_LABEL,
  RISK_CATEGORY_TONE,
  type Tone,
} from "@/lib/charter/rules";
import { Badge, Button, PageHeader, SectionCard } from "../../cosmos/kit";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  BarRow,
  FilterChips,
  Legend,
  ScreenError,
  SmartEmptyState,
  TableHead,
  TableRow,
} from "../base";
import { ModalProvider, useModal } from "../modal";
import { MitigationModal } from "../modals";
import { useCharterData } from "../use-charter-data";

const MIT_COLS = "78px 92px minmax(0,1fr) 150px 120px 110px";

function cellTone(score: number): Tone {
  if (score >= 16) {
    return "red";
  }
  if (score >= 9) {
    return "amber";
  }
  return "green";
}

function RiskInner() {
  const router = useRouter();
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [cell, setCell] = useState<string | null>(null);
  const [mitStatus, setMitStatus] = useState("all");

  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getRiskBoard(), [])
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading || !data) {
    return (
      <div className="fade-in">
        <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />
      </div>
    );
  }

  const selected = cell
    ? data.heatmap.find((h) => `${h.severity}-${h.likelihood}` === cell)
    : null;
  const visibleCases = selected
    ? data.cases.filter((c) => selected.codes.includes(c.code))
    : data.cases;

  const mitigations = data.mitigations.filter((m) =>
    mitStatus === "all"
      ? true
      : mitStatus === "OVERDUE"
        ? m.overdue
        : m.status === mitStatus
  );

  const maxCat = Math.max(1, ...data.categories.map((c) => c.total));

  const openMitigation = () =>
    open(
      <MitigationModal
        cases={data.cases.map((c) => ({ code: c.code, title: c.title }))}
        onClose={close}
        onSubmit={(input) =>
          startTransition(async () => {
            const res = await runWithToast(() => createMitigation(input), {
              loading: "Criando mitigação…",
              success: (d) => `Mitigação ${d.code} criada`,
            });
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
      />
    );

  return (
    <div className="fade-in">
      <PageHeader
        subtitle="Severidade × probabilidade de todos os casos ativos"
        title="Matriz de Risco"
      >
        <Button icon="plus" onClick={openMitigation}>
          Nova mitigação
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          subtitle={
            selected
              ? `Filtrando por severidade ${selected.severity} × probabilidade ${selected.likelihood}`
              : "Clique numa célula para filtrar a lista abaixo"
          }
          title="Heatmap"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 6,
            }}
          >
            {data.heatmap.map((h) => {
              const key = `${h.severity}-${h.likelihood}`;
              const tone = cellTone(h.severity * h.likelihood);
              const on = cell === key;
              return (
                <button
                  aria-label={`Severidade ${h.severity}, probabilidade ${h.likelihood}, ${h.count} casos`}
                  aria-pressed={on}
                  className="btn cell-hit"
                  key={key}
                  onClick={() => setCell(on ? null : key)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: "var(--r-sm)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    background:
                      h.count > 0 ? `var(--${tone}-soft)` : "var(--surface-3)",
                    color:
                      h.count > 0 ? `var(--${tone}-text)` : "var(--ink-faint)",
                    border: on
                      ? `2px solid var(--${tone})`
                      : "1px solid var(--hairline)",
                  }}
                  type="button"
                >
                  {/* Número sempre visível: a célula não pode depender só da cor. */}
                  {h.count}
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              fontSize: 10.5,
              color: "var(--ink-faint)",
            }}
          >
            <span>← probabilidade →</span>
            <span>↑ severidade</span>
          </div>
          <Legend
            items={[
              { label: "Crítico (≥16)", tone: "red", square: true },
              { label: "Elevado (≥9)", tone: "amber", square: true },
              { label: "Moderado / Baixo", tone: "green", square: true },
            ]}
          />
        </SectionCard>

        <SectionCard
          subtitle="Tom fixo por gravidade intrínseca da categoria"
          title="Distribuição por categoria"
        >
          {data.categories.map((c) => (
            <BarRow
              hint={`pico ${c.max}`}
              key={c.id}
              label={
                RISK_CATEGORY_LABEL[c.id as keyof typeof RISK_CATEGORY_LABEL]
              }
              max={maxCat}
              tone={RISK_CATEGORY_TONE[c.id as keyof typeof RISK_CATEGORY_TONE]}
              value={c.total}
            />
          ))}
          <p
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              lineHeight: 1.55,
              marginTop: 10,
              marginBottom: 0,
            }}
          >
            {
              RISK_CATEGORY_DESC[
                data.categories[0]?.id as keyof typeof RISK_CATEGORY_DESC
              ]
            }
          </p>
        </SectionCard>
      </div>

      <div style={{ marginTop: "var(--gap)" }}>
        <SectionCard
          action={
            selected && (
              <Button onClick={() => setCell(null)} size="sm" variant="ghost">
                Limpar filtro
              </Button>
            )
          }
          bodyStyle={{ padding: 0 }}
          title={`${visibleCases.length} casos`}
        >
          <TableHead
            cols="92px minmax(0,1fr) 110px 110px 120px"
            labels={[
              "ID",
              "Caso",
              { t: "Severidade", align: "right" },
              { t: "Probabilidade", align: "right" },
              "Score",
            ]}
          />
          {visibleCases.length === 0 ? (
            <SmartEmptyState
              icon="target"
              subtitle="Nenhum caso nesta célula do heatmap."
              title="Sem casos"
            />
          ) : (
            visibleCases.map((c, i) => (
              <TableRow
                cols="92px minmax(0,1fr) 110px 110px 120px"
                key={c.code}
                label={`Abrir ${c.code}`}
                last={i === visibleCases.length - 1}
                onClick={() => router.push(`/charter/case/${c.code}`)}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
                >
                  {c.code}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--ink)" }}>
                  {c.title}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12, textAlign: "right" }}
                >
                  {c.severity}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12, textAlign: "right" }}
                >
                  {c.likelihood}
                </span>
                <Badge tone={c.tone as Tone}>
                  {c.label} · {c.score}
                </Badge>
              </TableRow>
            ))
          )}
        </SectionCard>
      </div>

      <div style={{ marginTop: "var(--gap)" }}>
        <SectionCard
          action={
            <FilterChips
              allLabel="Todas"
              ariaLabel="Filtrar mitigações"
              onChange={setMitStatus}
              options={[
                { id: "OVERDUE", label: "Atrasadas", tone: "red" },
                { id: "OPEN", label: "Abertas" },
                { id: "PROGRESS", label: "Em andamento", tone: "amber" },
                { id: "DONE", label: "Concluídas", tone: "green" },
              ]}
              value={mitStatus}
            />
          }
          bodyStyle={{ padding: 0 }}
          subtitle="Atrasadas primeiro"
          title="Mitigações"
        >
          <TableHead
            cols={MIT_COLS}
            labels={["ID", "Caso", "Ação", "Categoria", "Dono", "Prazo"]}
          />
          {mitigations.length === 0 ? (
            <SmartEmptyState
              onPrimary={openMitigation}
              primaryLabel="Criar mitigação"
              subtitle="Nenhuma mitigação corresponde ao filtro."
              title="Sem mitigações"
            />
          ) : (
            mitigations.map((m, i) => (
              <TableRow
                cols={MIT_COLS}
                key={m.id}
                label={`Abrir ${m.useCaseCode}`}
                last={i === mitigations.length - 1}
                onClick={() => router.push(`/charter/case/${m.useCaseCode}`)}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
                >
                  {m.code}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--ink-muted)" }}
                >
                  {m.useCaseCode}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--ink)" }}>
                  {m.action}
                </span>
                <Badge
                  tone={
                    RISK_CATEGORY_TONE[
                      m.category as keyof typeof RISK_CATEGORY_TONE
                    ]
                  }
                >
                  {
                    RISK_CATEGORY_LABEL[
                      m.category as keyof typeof RISK_CATEGORY_LABEL
                    ]
                  }
                </Badge>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  {m.ownerName ?? "—"}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: m.overdue ? "var(--red-text)" : "var(--ink-muted)",
                  }}
                >
                  {m.overdue
                    ? "atrasada"
                    : m.dueDate
                      ? new Date(m.dueDate).toLocaleDateString("pt-BR")
                      : "—"}
                </span>
              </TableRow>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function RiskScreen() {
  return (
    <ModalProvider>
      <RiskInner />
    </ModalProvider>
  );
}
