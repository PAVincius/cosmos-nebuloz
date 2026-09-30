"use client";

// Versões e overlays — S-05, S-12, ST-01..ST-04.
// Port de `scaffold-screens-3.jsx`.
//
// A tela mostra três coisas que o método precisa deixar visíveis:
//
//   • Quantas trilhas rodam em CADA versão. É o que torna ST-03 tangível:
//     publicar a v4 não move ninguém da v3, e o número prova.
//   • De onde veio cada versão — "método Nebuloz" ou uma pessoa. Consultora que
//     promove uma mudança do campo aparece nominalmente; é a mitigação que o
//     PRD §7 escreve para "templates derivam do que consultores fazem".
//   • Conflito de overlay como item de trabalho, não como aviso. Enquanto ele
//     existe, nenhuma trilha nova nasce com aquele overlay.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  Card,
  KpiCard,
  PageHeader,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listTemplates,
  resolveConflict,
  type TemplateRow,
} from "@/app/(scaffold)/actions/templates";
import { workFormLabel } from "@/lib/scaffold/forms";
import {
  Eyebrow,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  StatusDot,
} from "../base";

function VersionTrail({ t }: { t: TemplateRow }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {t.versions.map((v, i) => {
        const current = i === 0;
        const last = i === t.versions.length - 1;
        return (
          <div
            key={v.id}
            style={{ display: "flex", gap: 12, paddingBottom: last ? 0 : 16 }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 99,
                  display: "grid",
                  placeItems: "center",
                  background: current
                    ? "var(--accent-soft)"
                    : "var(--surface-2)",
                  color: current ? "var(--accent-text)" : "var(--ink-faint)",
                  border: `1px solid ${current ? "rgba(var(--accent-rgb),.35)" : "var(--hairline)"}`,
                }}
              >
                <Icon name="lock" size={12} strokeWidth={2.2} />
              </span>
              {!last && (
                <span
                  style={{
                    flex: 1,
                    width: 1,
                    background: "var(--hairline)",
                    marginTop: 4,
                  }}
                />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: "var(--ink)",
                  }}
                >
                  {v.label}
                </span>
                {current && <Badge tone="accent">vigente</Badge>}
                <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                  {v.publishedAt.toLocaleDateString("pt-BR")} · {v.authorLabel}
                </span>
                {/* ST-03 tangível: publicar não move ninguém de versão. */}
                <span
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    padding: "1px 7px",
                    borderRadius: 99,
                    background:
                      v.trackCount > 0 ? "var(--green-soft)" : "var(--chip-bg)",
                    color:
                      v.trackCount > 0
                        ? "var(--green-text)"
                        : "var(--ink-faint)",
                  }}
                  title="Trilhas que rodam nesta versão"
                >
                  {v.trackCount} trilha{v.trackCount === 1 ? "" : "s"}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  marginTop: 3,
                  lineHeight: 1.45,
                }}
              >
                {v.note}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-faint)",
                  marginTop: 3,
                }}
              >
                {v.stepCount} passos · {v.criterionCount} critérios
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OverlayList({
  t,
  onResolve,
  busy,
}: {
  t: TemplateRow;
  onResolve: (conflictIds: string[]) => void;
  busy: boolean;
}) {
  if (t.overlays.length === 0) {
    return (
      <div
        style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "4px 0" }}
      >
        Nenhuma customização desta organização sobre este template.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {t.overlays.map((o) => (
        <div
          key={o.id}
          style={{
            padding: "11px 13px",
            borderRadius: "var(--r-md)",
            background: o.openConflictIds.length
              ? "var(--red-soft)"
              : "var(--surface-2)",
            border: `1px solid ${o.openConflictIds.length ? "rgba(var(--red-rgb),.3)" : "var(--hairline)"}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
            >
              {o.name}
            </span>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-faint)" }}
            >
              base {o.baseVersionLabel} · {o.opCount} operação
              {o.opCount === 1 ? "" : "ões"}
            </span>
            {o.criterionOpCount > 0 && (
              <Badge tone="amber">Critério sem efeito no gate</Badge>
            )}
            {o.openConflictIds.length > 0 && (
              <Badge tone="red">
                {o.openConflictIds.length} conflito
                {o.openConflictIds.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          {o.openConflictIds.length > 0 && (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                marginTop: 7,
                lineHeight: 1.5,
              }}
            >
              Enquanto o conflito existir, nenhuma trilha nova nasce com este
              overlay — uma trilha criada sobre conflito não sabe quais passos
              são os seus.
              <div style={{ marginTop: 9 }}>
                <Button
                  disabled={busy}
                  icon="check"
                  onClick={() => onResolve(o.openConflictIds)}
                  size="sm"
                  variant="secondary"
                >
                  Manter a customização
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TemplatesScreen() {
  const [data, setData] = useState<TemplateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await listTemplates();
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const rows = data ?? [];
    return {
      templates: rows.length,
      versions: rows.reduce((n, t) => n + t.versions.length, 0),
      overlays: rows.reduce((n, t) => n + t.overlays.length, 0),
      conflicts: rows.reduce(
        (n, t) =>
          n + t.overlays.reduce((m, o) => m + o.openConflictIds.length, 0),
        0
      ),
    };
  }, [data]);

  // Resolver da tela é sempre `keep_overlay`: as outras duas resoluções
  // descartam a customização do cliente, e isso não se faz num clique de lista.
  //
  // Resolve TODOS os conflitos abertos do overlay: da lista, a decisão é "esta
  // customização continua valendo", que vale para o overlay inteiro. Decisão
  // conflito a conflito é do editor, que não existe nesta fatia.
  const keepOverlay = useCallback(
    async (conflictIds: string[]) => {
      setBusy(true);
      for (const conflictId of conflictIds) {
        const res = await resolveConflict({
          conflictId,
          resolution: "keep_overlay",
        });
        if (!res.ok) {
          setBusy(false);
          setError(res.error);
          return;
        }
      }
      setBusy(false);
      await load();
    },
    [load]
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
        eyebrow="Método"
        meta={
          <StatusDot
            label={
              totals.conflicts
                ? `${totals.conflicts} conflito${totals.conflicts > 1 ? "s" : ""} de overlay`
                : "Nenhum conflito pendente"
            }
            tone={totals.conflicts ? "red" : "green"}
          />
        }
        subtitle="O método da Nebuloz como dado. Versão publicada é imutável; a customização do cliente é overlay, não fork — e sobrevive ao upgrade ou vira conflito explícito."
        title="Versões e overlays"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {loading ? (
          ["a", "b", "c", "d"].map((k) => <SkeletonKpi key={k} />)
        ) : (
          <>
            <KpiCard
              hint="um por arquétipo de processo"
              icon="puzzle"
              label="Templates"
              tone="accent"
              value={totals.templates}
            />
            <KpiCard
              hint="imutáveis · nada reescreve"
              icon="lock"
              label="Versões publicadas"
              tone="green"
              value={totals.versions}
            />
            <KpiCard
              hint="customizações desta organização"
              icon="layers"
              label="Overlays"
              tone="blue"
              value={totals.overlays}
            />
            <KpiCard
              hint="travam a criação de trilha"
              icon="alert"
              label="Conflitos abertos"
              tone={totals.conflicts ? "red" : "neutral"}
              value={totals.conflicts}
            />
          </>
        )}
      </div>

      {loading ? (
        <SkeletonCard />
      ) : data.length === 0 ? (
        <Card>
          <SmartEmptyState
            icon="puzzle"
            subtitle="Rode o seed do método (`pnpm --filter @repo/database seed:scaffold`) para publicar os três arquétipos."
            title="Nenhum template publicado"
            tone="accent"
          />
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          {data.map((t) => (
            <SectionCard
              action={
                t.currentLabel ? (
                  <Badge tone="accent">{t.currentLabel}</Badge>
                ) : null
              }
              icon="puzzle"
              key={t.id}
              subtitle={workFormLabel(t.archetype)}
              title={t.name}
              tone="accent"
            >
              <Eyebrow style={{ marginBottom: 9 }}>Versões</Eyebrow>
              <VersionTrail t={t} />
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--hairline)",
                }}
              >
                <Eyebrow style={{ marginBottom: 9 }}>
                  Overlays desta organização
                </Eyebrow>
                <OverlayList busy={busy} onResolve={keepOverlay} t={t} />
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
