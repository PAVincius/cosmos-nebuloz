"use client";

// Iniciativas — US1. Port de `signal-screens-1.jsx`.
//
// A lista existe para responder "onde o dinheiro rende" antes de qualquer
// clique. Por isso ordena por veredito e não por nome: quem abre esta tela
// quer ver primeiro o que está em risco, não o que começa com A.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  type InitiativeCard,
  listInitiatives,
} from "@/app/(signal)/actions/initiatives";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/signal/lifecycle";
import {
  type ChipOption,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useModal,
  useSignalData,
} from "../base";
import { InitiativeForm } from "../modal";
import { ValueReading } from "../verdict-badge";

/** Ordem de leitura: o que precisa de decisão primeiro. */
const VERDICT_RANK: Record<string, number> = {
  VANITY: 0,
  STOP: 1,
  PROMISE: 2,
  PROVEN: 3,
};

const STATUS_FILTERS: ChipOption[] = [
  { id: "ACTIVE", label: "Ativas", tone: "green" },
  { id: "DRAFT", label: "Rascunho", tone: "neutral" },
  { id: "PAUSED", label: "Pausadas", tone: "amber" },
  { id: "CLOSED", label: "Encerradas", tone: "blue" },
];

function emptyTitle(status: string): string {
  if (status === "all") {
    return "Nenhuma iniciativa registrada";
  }
  const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL];
  return `Nenhuma iniciativa ${label?.toLowerCase() ?? ""}`.trim();
}

export default function InitiativesScreen() {
  const router = useRouter();
  const modal = useModal();
  const [status, setStatus] = useState("all");
  const fetcher = useCallback(
    () =>
      listInitiatives(
        status === "all"
          ? {}
          : { status: status as "ACTIVE" | "DRAFT" | "PAUSED" | "CLOSED" }
      ),
    [status]
  );
  const { data, loading, error, reload } =
    useSignalData<InitiativeCard[]>(fetcher);

  const rows = useMemo(() => {
    const items = data ?? [];
    return [...items].sort((a, b) => {
      const byVerdict =
        (VERDICT_RANK[a.verdict] ?? 9) - (VERDICT_RANK[b.verdict] ?? 9);
      return byVerdict === 0 ? a.code.localeCompare(b.code) : byVerdict;
    });
  }, [data]);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const open = (code: string) => router.push(`/signal/initiative/${code}`);

  // Criar leva direto para o detalhe: é lá que o baseline é assinado, e sem ele
  // a iniciativa recém-criada não sai do rascunho.
  const openNew = () =>
    modal.open(<InitiativeForm onSaved={(code) => open(code)} />);

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Valor · portfólio"
        subtitle="Cada linha traz adoção e retorno juntos, com a versão da fórmula e a confiança que sustentam o número."
        title="Iniciativas"
        tone="accent"
      >
        <Button icon="plus" onClick={openNew}>
          Nova iniciativa
        </Button>
      </PageHeader>

      <FilterChips
        ariaLabel="Filtrar iniciativas por status"
        onChange={setStatus}
        options={STATUS_FILTERS}
        value={status}
      />

      {loading ? <SkeletonRows cols="1fr" rows={5} /> : null}

      {!loading && rows.length === 0 ? (
        <SmartEmptyState
          icon="target"
          onPrimary={openNew}
          primaryIcon="plus"
          primaryLabel="Registrar a primeira iniciativa"
          subtitle="Para medir uma iniciativa de IA você precisa de duas coisas em mãos: uma hipótese falseável (o que deveria melhorar, e quanto) e um baseline — como o processo estava ANTES. Sem baseline, o ganho medido depois não tem contra-prova."
          title={emptyTitle(status)}
          tone="accent"
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 8 }}
          title={`${rows.length} iniciativa${rows.length > 1 ? "s" : ""}`}
        >
          {rows.map((r) => (
            <button
              className="btn lift"
              key={r.code}
              onClick={() => open(r.code)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: "100%",
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface-2)",
              }}
              type="button"
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink-faint)",
                  }}
                >
                  {r.code}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {r.name}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    color: "var(--ink-faint)",
                  }}
                >
                  <Icon name={CATEGORY_ICON[r.category]} size={12} />
                  {CATEGORY_LABEL[r.category]} · {r.businessUnit}
                </span>
                <span
                  className="mono"
                  style={{
                    marginLeft: "auto",
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: `var(--${STATUS_TONE[r.status]}-soft)`,
                    color: `var(--${STATUS_TONE[r.status]}-text)`,
                  }}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </span>

              <ValueReading
                adoptionPct={r.adoptionPct}
                compact
                confidenceBand={r.confidenceBand}
                confidenceScore={r.confidenceScore}
                formulaVersion={r.formulaVersion}
                multiple={r.multiple}
                verdictLabel={r.verdictLabel}
                verdictTone={r.verdictTone}
              />

              {r.baselineVersion === null ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--amber-text)",
                  }}
                >
                  <Icon name="alert" size={12} />
                  Sem baseline assinado — o ganho reportado não tem
                  contra-prova.
                </span>
              ) : null}
            </button>
          ))}
        </SectionCard>
      ) : null}
    </div>
  );
}
