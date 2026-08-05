"use client";

import {
  Badge,
  CopyId,
  Progress,
  Skel,
  useNav,
} from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import type { EpicDetailFull } from "@/app/(cosmos)/actions/epic-detail";
import { listFeatureStories } from "@/app/(cosmos)/actions/epic-tree";
import type { StoryNode } from "@/app/(cosmos)/actions/epic-tree.constants";
import { Chevron, StoryRow } from "./story-row";

type FeatureItem = EpicDetailFull["features"][number];

// Mesma grade no header e nas linhas — qualquer divergência desalinha a tabela.
const GRID = "minmax(0,1fr) 140px 90px 80px 70px 30px";

const FEATURE_STATE_TONE: Record<string, "neutral" | "blue" | "green"> = {
  BACKLOG: "neutral",
  ANALYSIS: "blue",
  REVIEW: "blue",
  IMPLEMENTING: "blue",
  DONE: "green",
};

export function FeatureTable({ features }: { features: FeatureItem[] }) {
  if (features.length === 0) {
    return (
      <div style={{ padding: "22px 16px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
          Nenhuma feature vinculada a este épico.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          gap: 10,
          padding: "9px 14px",
          fontSize: 11,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <span>Feature</span>
        <span>WSJF</span>
        <span>Estado</span>
        <span>Progresso</span>
        <span style={{ textAlign: "right" }}>SP</span>
        <span />
      </div>
      {features.map((f) => (
        <FeatureRow feature={f} key={f.id} />
      ))}
    </div>
  );
}

function FeatureRow({ feature }: { feature: FeatureItem }) {
  const { navigate } = useNav();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryNode[] | null>(null);

  const panelId = `feature-stories-${feature.id}`;

  async function load() {
    setLoading(true);
    setError(null);
    const res = await listFeatureStories(feature.id);
    setLoading(false);
    if (res.ok) {
      setStories(res.data);
    } else {
      setError(res.error);
    }
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && stories === null && !loading) {
      load();
    }
  }

  return (
    <div>
      {/* A FeatureRow contém o botão ↗ aninhado — botão dentro de botão é
          HTML inválido, então esta linha (ao contrário da StoryRow) fica
          mesmo como div com role. Mesma convenção de wsjf-client.tsx:112. */}
      {/* biome-ignore lint/a11y/useSemanticElements: wraps a nested ↗ button; a native <button> here would be invalid HTML */}
      <div
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        role="button"
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "var(--surface)",
          borderBottom: expanded ? "none" : "1px solid var(--hairline)",
          cursor: "pointer",
        }}
        tabIndex={0}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <Chevron open={expanded} />
          <CopyId value={feature.id}>
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-faint)" }}
            >
              {feature.id.slice(0, 8)}
            </span>
          </CopyId>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {feature.title}
          </span>
        </div>

        <span
          className="mono"
          style={{ fontSize: 12, color: "var(--ink-muted)" }}
        >
          {feature.wsjfScore}
        </span>

        <Badge dot tone={FEATURE_STATE_TONE[feature.statusId] ?? "neutral"}>
          {feature.statusId}
        </Badge>

        <Progress tone="accent" value={feature.progressPct} />

        <span
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            textAlign: "right",
          }}
        >
          {feature.storyPoints}
        </span>

        <button
          aria-label={`Abrir feature ${feature.title}`}
          onClick={(e) => {
            // Sem isto o clique borbulha para a linha e alterna a expansão.
            e.stopPropagation();
            navigate("feature", feature.id);
          }}
          style={{
            width: 26,
            height: 26,
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            color: "var(--ink-faint)",
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1,
          }}
          type="button"
        >
          ↗
        </button>
      </div>

      {/* Sempre montado, escondido por `hidden`: um aria-controls apontando
          para id inexistente não é resolvível por leitor de tela, e a linha
          passa a maior parte da vida colapsada. Não quebra a preguiça — o
          fetch dispara no toggle, não na renderização. */}
      <div
        hidden={!expanded}
        id={panelId}
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        {expanded && (
          <>
            {loading && (
              <div style={{ padding: "10px 14px 10px 34px" }}>
                <Skel h={28} />
              </div>
            )}

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px 10px 34px",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--red-text)" }}>
                  {error}
                </span>
                <button
                  onClick={load}
                  style={{
                    fontSize: 11.5,
                    padding: "3px 9px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!(loading || error) && stories?.length === 0 && (
              <div style={{ padding: "10px 14px 10px 34px" }}>
                <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  Nenhuma story nesta feature.
                </span>
              </div>
            )}

            {stories?.map((s) => (
              <StoryRow key={s.id} story={s} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
