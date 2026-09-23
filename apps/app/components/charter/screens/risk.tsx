"use client";

// Matriz de Risco — FR-7. Port de `charter-screens-2.jsx`.

import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { createMitigation, getRiskBoard } from "@/app/(charter)/actions/risk";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_TONE,
  RISK_CATEGORY_LABEL,
  RISK_CATEGORY_TONE,
  type Tone,
} from "@/lib/charter/rules";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  BarRow,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  TableRow,
} from "../base";
import { ModalProvider, useModal } from "../modal";
import { MitigationModal } from "../modals/mitigation";
import { Heatmap, MitigationTable } from "../parts";
import { FS } from "../type-scale";
import { useCharterData } from "../use-charter-data";

const CASE_COLS = "minmax(0,1fr) 108px 70px";

function scoreTone(score: number): Tone {
  if (score >= 16) {
    return "red";
  }
  if (score >= 9) {
    return "amber";
  }
  return "green";
}

/** Casos fora do mapa por falta de pontuação. Fio tracejado = ainda não
 *  medido, a mesma leitura das sugestões de condição no modal de decisão. */
function UnscoredCases({
  cases,
  onOpen,
}: {
  cases: { code: string; title: string }[];
  onOpen: (code: string) => void;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          fontSize: FS.nota,
          color: "var(--ink-muted)",
          lineHeight: 1.5,
          marginBottom: 9,
        }}
      >
        {cases.length}{" "}
        {cases.length === 1
          ? "caso sem pontuação fica fora do mapa"
          : "casos sem pontuação ficam fora do mapa"}{" "}
        até alguém pontuar o risco na aba Risco do caso.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {cases.map((c) => (
          <button
            className="btn"
            key={c.code}
            onClick={() => onOpen(c.code)}
            style={{
              display: "inline-flex",
              gap: 6,
              maxWidth: 280,
              padding: "5px 10px",
              borderRadius: 99,
              fontSize: FS.nota,
              fontWeight: 600,
              border: "1px dashed var(--hairline-strong)",
              background: "transparent",
              color: "var(--ink-muted)",
              cursor: "pointer",
            }}
            type="button"
          >
            <span className="mono" style={{ color: "var(--ink)" }}>
              {c.code}
            </span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RiskInner() {
  const router = useRouter();
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [cell, setCell] = useState<[number, number] | null>(null);

  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getRiskBoard(), [])
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const cases = data?.cases ?? [];
  const critical = cases.filter((c) => (c.score ?? 0) >= 16);
  const elevated = cases.filter(
    (c) => c.score !== null && c.score >= 9 && c.score < 16
  );
  // Caso que ninguém pontuou fica fora do mapa (getRiskBoard), mas não some:
  // é nomeado embaixo, com o caminho para pontuar.
  const unscored = cases.filter((c) => c.score === null);
  const mitigations = data?.mitigations ?? [];
  const openMits = mitigations.filter((m) => m.status !== "DONE");
  const overdue = mitigations.filter((m) => m.overdue);
  const inCell = cell
    ? cases.filter((c) => c.severity === cell[0] && c.likelihood === cell[1])
    : null;
  const maxCat = Math.max(1, ...(data?.categories.map((c) => c.max) ?? [1]));

  const openMitigation = () =>
    open(
      <MitigationModal
        cases={cases.map((c) => ({ code: c.code, title: c.title }))}
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
        eyebrow={`${cases.length} casos ativos · ${Object.keys(RISK_CATEGORY_LABEL).length} categorias de risco`}
        meta={
          <>
            <Badge dot tone="red">
              {critical.length} críticos
            </Badge>
            <Badge tone="amber">{elevated.length} elevados</Badge>
            <Badge tone={overdue.length ? "red" : "green"}>
              {overdue.length}{" "}
              {overdue.length === 1
                ? "mitigação atrasada"
                : "mitigações atrasadas"}
            </Badge>
          </>
        }
        subtitle="Uma escala para todos os casos. Sem matriz comum, cada área classifica risco do seu jeito e a comparação some."
        title="Matriz de Risco de IA"
        tone="red"
      >
        <Button icon="plus" onClick={openMitigation}>
          Nova mitigação
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        {loading ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          <>
            <KpiCard
              hint="score ≥ 16"
              icon="alert"
              label="Casos críticos"
              tone="red"
              value={critical.length}
            />
            <KpiCard
              hint="entre 9 e 15"
              icon="target"
              label="Casos elevados"
              tone="amber"
              value={elevated.length}
            />
            <KpiCard
              hint={`de ${mitigations.length} registradas`}
              icon="shield"
              label="Mitigações abertas"
              tone="accent"
              value={openMits.length}
            />
            <KpiCard
              delta={overdue.length ? "ação imediata" : "em dia"}
              deltaTone={overdue.length ? "red" : "green"}
              icon="clock"
              label="Mitigações atrasadas"
              tone={overdue.length ? "red" : "green"}
              value={overdue.length}
            />
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          action={
            cell && (
              <Button
                icon="x"
                onClick={() => setCell(null)}
                size="sm"
                variant="ghost"
              >
                Limpar
              </Button>
            )
          }
          icon="grid"
          subtitle="Clique numa célula para ver os casos nela"
          title="Mapa de calor"
          tone="red"
        >
          {loading || !data ? (
            <div
              className="skeleton"
              style={{ height: 220, borderRadius: 10 }}
            />
          ) : cases.length === 0 ? (
            <SmartEmptyState
              icon="inbox"
              onPrimary={() => router.push("/charter/cases")}
              primaryIcon="arrowRight"
              primaryLabel="Ver casos de uso"
              subtitle="Sem caso de uso ativo, não há risco para posicionar no mapa de calor."
              title="Nenhum caso de uso ainda"
              tone="accent"
            />
          ) : unscored.length === cases.length ? (
            <SmartEmptyState
              icon="target"
              subtitle="Nenhum caso ativo tem risco pontuado. O mapa só posiciona o que alguém avaliou — o padrão do intake não entra."
              title="Nenhum risco avaliado ainda"
              tone="accent"
            />
          ) : (
            <Heatmap cells={data.heatmap} onSelect={setCell} selected={cell} />
          )}
          {data && unscored.length > 0 && (
            <UnscoredCases
              cases={unscored}
              onOpen={(code) => router.push(`/charter/case/${code}`)}
            />
          )}
        </SectionCard>

        <SectionCard
          bodyStyle={inCell ? { padding: 0 } : undefined}
          icon="target"
          subtitle={
            inCell
              ? `${inCell.length} caso(s) nesta célula`
              : "Casos ativos com severidade 4 ou 5"
          }
          title={
            inCell && cell
              ? `Casos em severidade ${cell[0]} × probabilidade ${cell[1]}`
              : "Exposição por categoria"
          }
          tone="amber"
        >
          {inCell ? (
            inCell.length === 0 ? (
              <SmartEmptyState
                icon="check"
                onSecondary={() => setCell(null)}
                secondaryLabel="Limpar seleção"
                subtitle="Nenhum caso ativo nesta combinação de severidade e probabilidade."
                title="Célula vazia"
                tone="green"
              />
            ) : (
              inCell.map((c, i) => (
                <TableRow
                  cols={CASE_COLS}
                  key={c.code}
                  label={`Abrir ${c.code}`}
                  last={i === inCell.length - 1}
                  onClick={() => router.push(`/charter/case/${c.code}`)}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: FS.micro,
                        fontWeight: 700,
                        color: "var(--ink-faint)",
                      }}
                    >
                      {c.code}
                    </span>
                    <div
                      style={{
                        fontSize: FS.base,
                        fontWeight: 600,
                        color: "var(--ink)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.title}
                    </div>
                  </div>
                  <Badge tone={DATA_CLASS_TONE[c.dataClass]}>
                    {DATA_CLASS_LABEL[c.dataClass]}
                  </Badge>
                  <span
                    className="mono"
                    style={{
                      fontSize: FS.base,
                      fontWeight: 800,
                      color: `var(--${scoreTone(c.score ?? 0)}-text)`,
                      textAlign: "right",
                    }}
                  >
                    {c.score ?? "—"}
                  </span>
                </TableRow>
              ))
            )
          ) : loading || !data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            data.categories.map((c) => (
              <BarRow
                hint={`pico ${c.max}`}
                key={c.id}
                label={
                  RISK_CATEGORY_LABEL[c.id as keyof typeof RISK_CATEGORY_LABEL]
                }
                max={maxCat}
                tone={
                  RISK_CATEGORY_TONE[c.id as keyof typeof RISK_CATEGORY_TONE]
                }
                value={c.total}
              />
            ))
          )}
        </SectionCard>
      </div>

      <SectionCard
        action={
          <Badge tone={overdue.length ? "red" : "green"}>
            {mitigations.filter((m) => m.status === "DONE").length}/
            {mitigations.length} concluídas
          </Badge>
        }
        bodyStyle={{ padding: 0 }}
        icon="shield"
        subtitle="Toda mitigação tem dono, prazo e status — risco sem dono é risco aceito por omissão"
        title="Rastreador de mitigações"
        tone="accent"
      >
        {loading ? (
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : mitigations.length === 0 ? (
          cases.length === 0 ? (
            <SmartEmptyState
              icon="inbox"
              onPrimary={() => router.push("/charter/cases")}
              primaryIcon="arrowRight"
              primaryLabel="Ver casos de uso"
              subtitle="Sem caso de uso ativo, ainda não há risco para mitigar."
              title="Nenhum caso de uso ainda"
              tone="accent"
            />
          ) : (
            <SmartEmptyState
              icon="shield"
              onPrimary={openMitigation}
              primaryIcon="plus"
              primaryLabel="Nova mitigação"
              subtitle="Casos ativos existem, mas nenhuma mitigação foi registrada ainda."
              title="Nenhuma mitigação registrada"
              tone="accent"
            />
          )
        ) : (
          <MitigationTable
            onOpen={(useCaseCode) =>
              router.push(`/charter/case/${useCaseCode}`)
            }
            rows={mitigations}
          />
        )}
      </SectionCard>
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
