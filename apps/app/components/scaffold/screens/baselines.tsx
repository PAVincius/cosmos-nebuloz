"use client";

// Casos de negócio — lista. S-06. Port de `scaffold-screens-baseline.jsx`.
//
// O baseline assinado é o artefato que o Signal apura por meses. Nasce aqui,
// congela na assinatura e nunca é editado fora do Scaffold.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Card,
  KpiCard,
  PageHeader,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BusinessCaseListing,
  listBusinessCases,
} from "@/app/(scaffold)/actions/business-case";
import {
  FilterChips,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  StatusDot,
  TableHead,
  TableRow,
} from "../base";

/** Rótulo e tom por estado. Espelha `BC_STATE` do protótipo. */
export const BC_STATE: Record<
  string,
  {
    label: string;
    tone: "accent" | "amber" | "red" | "green" | "neutral";
    desc: string;
  }
> = {
  DRAFT: {
    label: "Rascunho",
    tone: "accent",
    desc: "Editável pela consultoria. O Signal ainda não lê.",
  },
  AWAITING: {
    label: "Aguardando assinatura",
    tone: "amber",
    desc: "Congelado. Enviado ao patrocinador.",
  },
  CONTESTED: {
    label: "Contestado",
    tone: "red",
    desc: "O patrocinador devolveu com objeção.",
  },
  SIGNED: {
    label: "Assinado",
    tone: "green",
    desc: "Imutável. O Signal apura contra esta versão.",
  },
  SUPERSEDED: {
    label: "Substituído",
    tone: "neutral",
    desc: "Versão anterior, mantida para auditoria.",
  },
};

const KPI_SLOTS = ["signed", "pending", "draft", "missing"] as const;
const COLS = "104px minmax(200px,1.7fr) 128px 150px 116px 96px";

export default function BaselinesScreen() {
  const router = useRouter();
  const [data, setData] = useState<BusinessCaseListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("all");

  const load = useCallback(async () => {
    setError(null);
    const res = await listBusinessCases();
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) => stateFilter === "all" || r.state === stateFilter
      ),
    [data, stateFilter]
  );

  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }
  const loading = !data;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Método · Promessa"
        meta={
          <StatusDot
            label={
              data?.pendingCount
                ? `${data.pendingCount} aguardando contraparte`
                : "Nenhuma pendência de assinatura"
            }
            tone={data?.pendingCount ? "amber" : "green"}
          />
        }
        subtitle="O baseline assinado é o artefato que o Signal apura por meses. Nasce aqui, congela na assinatura e nunca é editado fora do Scaffold."
        title="Casos de negócio"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {loading ? (
          KPI_SLOTS.map((slot) => <SkeletonKpi key={slot} />)
        ) : (
          <>
            <KpiCard
              hint="imutáveis · o Signal lê"
              icon="lock"
              label="Assinados"
              tone="green"
              unit={`de ${data.rows.length}`}
              value={data.signedCount}
            />
            <KpiCard
              hint="congelados até resposta"
              icon="clock"
              label="Aguardando contraparte"
              tone="amber"
              value={data.pendingCount}
            />
            <KpiCard
              hint="editáveis pela consultoria"
              icon="fileText"
              label="Em rascunho"
              tone="accent"
              value={data.draftCount}
            />
            <KpiCard
              hint="o Signal não tem o que medir"
              icon="alert"
              label="Trilhas sem promessa"
              tone={data.tracksWithoutPromise ? "red" : "neutral"}
              value={data.tracksWithoutPromise}
            />
          </>
        )}
      </div>

      <FilterChips
        allLabel="Todos os estados"
        ariaLabel="Filtrar por estado do caso de negócio"
        onChange={setStateFilter}
        options={Object.entries(BC_STATE)
          .filter(([k]) => k !== "SUPERSEDED")
          .map(([id, v]) => ({ id, label: v.label }))}
        value={stateFilter}
      />

      <Card pad={false}>
        <TableHead
          cols={COLS}
          labels={[
            "Artefato",
            "Processo",
            "Estado",
            "Signatário",
            "Janela",
            "Versão",
          ]}
        />
        {loading ? (
          <div style={{ padding: 14 }}>
            <SkeletonCard />
          </div>
        ) : visible.length === 0 ? (
          <SmartEmptyState
            icon="search"
            onPrimary={() => setStateFilter("all")}
            primaryIcon="minus"
            primaryLabel="Limpar filtros"
            subtitle="Limpe o filtro, ou emita um caso de negócio a partir do gate de Assess de uma trilha."
            title="Nenhum caso de negócio nesse recorte"
            tone="blue"
          />
        ) : (
          visible.map((b, i) => (
            <TableRow
              cols={COLS}
              key={b.id}
              label={`Abrir caso de negócio ${b.code}`}
              last={i === visible.length - 1}
              onClick={() => router.push(`/scaffold/baseline/${b.id}`)}
            >
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--accent-text)",
                }}
              >
                {b.code}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.processName}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-faint)",
                    marginTop: 2,
                  }}
                >
                  trilha {b.trackCode}
                </div>
              </div>
              <Badge tone={BC_STATE[b.state]?.tone ?? "neutral"}>
                {BC_STATE[b.state]?.label ?? b.state}
              </Badge>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.sponsorLabel ?? "—"}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
                  {b.signedAt
                    ? b.signedAt.toLocaleDateString("pt-BR")
                    : (BC_STATE[b.state]?.label ?? "")}
                </div>
              </div>
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--ink-muted)" }}
              >
                {b.windowMonths ? `${b.windowMonths} meses` : "—"}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "var(--chip-bg)",
                    color: "var(--ink-muted)",
                  }}
                >
                  {b.versionLabel}
                </span>
              </div>
            </TableRow>
          ))
        )}
      </Card>

      {!loading && data.tracksWithoutPromise > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "14px 16px",
            borderRadius: "var(--r-lg)",
            background: "var(--red-soft)",
            border: "1px solid rgba(var(--red-rgb),.3)",
          }}
        >
          <Icon
            name="alert"
            size={17}
            style={{ color: "var(--red-text)", flexShrink: 0, marginTop: 1 }}
          />
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--red-text)",
              }}
            >
              {data.tracksWithoutPromise} trilha
              {data.tracksWithoutPromise > 1 ? "s" : ""} sem caso de negócio
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-muted)",
                marginTop: 3,
                lineHeight: 1.5,
                maxWidth: "76ch",
              }}
            >
              Sem baseline assinado, o Signal exibe a iniciativa como{" "}
              <strong>aguardando promessa</strong> — nunca como zero. E a Fase 1
              não fecha (SG-04), o que é o mesmo fato visto do outro lado.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
