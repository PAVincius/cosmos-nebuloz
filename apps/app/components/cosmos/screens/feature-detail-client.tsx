"use client";

// feature-detail-client.tsx — feature drilldown (design handoff
// screen-bundle-2.jsx FeatureDetailScreen). Adds the Stories → Tasks
// drilldown, a breadcrumb back to the parent epic, and prev/next feature
// navigation — all sourced from getFeature() (real Story/Task rows,
// tenant-scoped). Prev/next follows the same order the epic screen lists
// features in (wsjfScore desc), so it never guesses an ordering.
import { useState } from "react";
import type {
  FeatureDetail,
  FeatureStoryView,
} from "@/app/(cosmos)/actions/epics";
import { EmptyState } from "../empty-state";
import { Icon } from "../icons";
import {
  Badge,
  KpiCard,
  NavButton,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useNav,
} from "../kit";

const TASK_TONE: Record<string, Tone> = {
  DONE: "green",
  IN_PROGRESS: "accent",
};

function StoryRow({ story }: { story: FeatureStoryView }) {
  const [expanded, setExpanded] = useState(false);
  const doneTasks = story.tasks.filter((t) => t.status === "DONE").length;

  return (
    <div>
      <button
        className="lift"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 100px 70px",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderTop: "1px solid var(--hairline)",
          background: "transparent",
          textAlign: "left",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
        type="button"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <Icon
            name="chevronRight"
            size={13}
            strokeWidth={2.4}
            style={{
              color: "var(--ink-faint)",
              flexShrink: 0,
              transform: expanded ? "rotate(90deg)" : "none",
              transition: "transform .15s",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {story.title}
          </span>
        </div>
        <Badge tone="neutral">{story.status}</Badge>
        <span
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            textAlign: "right",
          }}
        >
          {story.storyPoints} SP
        </span>
      </button>
      {expanded &&
        (story.tasks.length === 0 ? (
          <div
            style={{
              padding: "4px 16px 14px 39px",
              fontSize: 12.5,
              color: "var(--ink-faint)",
            }}
          >
            Nenhuma task cadastrada.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "4px 16px 14px 39px",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              {doneTasks}/{story.tasks.length} tasks concluídas
            </span>
            {story.tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "6px 10px",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--hairline)",
                  background: "var(--surface-2)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--ink)" }}>
                  {t.title}
                </span>
                <Badge tone={TASK_TONE[t.status] ?? "neutral"}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export default function FeatureDetailClient({
  initial,
}: {
  initial: FeatureDetail;
}) {
  const { navigate } = useNav();
  const f = initial;
  const doneStories = f.stories.filter((s) => s.status === "DONE").length;

  return (
    <div className="fade-in">
      {f.epicId && (
        <button
          className="btn"
          onClick={() => navigate("epic", f.epicId as string)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: "var(--ink-muted)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 14,
            padding: 0,
          }}
          type="button"
        >
          ← {f.epicTitle ?? "Ver Épico"}
        </button>
      )}

      <PageHeader
        eyebrow="Portfolio · Feature"
        meta={
          <>
            <Badge tone="accent">{f.statusId}</Badge>
            <Badge dot tone="green">
              WSJF {f.wsjfScore}
            </Badge>
          </>
        }
        title={f.title}
      >
        {(f.prevFeatureId || f.nextFeatureId) && (
          <div style={{ display: "flex", gap: 6 }}>
            {f.prevFeatureId && (
              <NavButton
                param={f.prevFeatureId}
                size="sm"
                to="feature"
                variant="secondary"
              >
                ‹ Anterior
              </NavButton>
            )}
            {f.nextFeatureId && (
              <NavButton
                param={f.nextFeatureId}
                size="sm"
                to="feature"
                variant="secondary"
              >
                Próxima ›
              </NavButton>
            )}
          </div>
        )}
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          icon="dollar"
          label="Business Value"
          tone="green"
          value={f.bv}
        />
        <KpiCard
          icon="clock"
          label="Time Criticality"
          tone="amber"
          value={f.tc}
        />
        <KpiCard
          icon="shield"
          label="Risk Reduction"
          tone="blue"
          value={f.rr}
        />
        <KpiCard icon="layers" label="Job Size" tone="purple" value={f.js} />
      </div>
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="activity"
        subtitle={`${f.storyPoints} SP`}
        title="Progresso"
        tone="accent"
      >
        <Progress tone="accent" value={f.progressPct} />
      </SectionCard>
      <div style={{ marginTop: 18 }}>
        <SectionCard
          bodyStyle={{ padding: "12px 16px" }}
          icon="check"
          subtitle={`${f.acceptanceCriteria.length} itens`}
          title="Critérios de Aceite"
          tone="green"
        >
          {f.acceptanceCriteria.length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum critério cadastrado.
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {f.acceptanceCriteria.map((criterion, index) => (
                <div
                  key={`${index}-${criterion}`}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <Badge dot tone="green">
                    {index + 1}
                  </Badge>
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>
                    {criterion}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <div style={{ marginTop: 18 }}>
        <SectionCard
          bodyStyle={{ padding: 0 }}
          icon="kanban"
          subtitle={`${f.stories.length} stories · ${doneStories} concluídas · clique para ver tasks`}
          title="Stories"
          tone="accent"
        >
          {f.stories.length === 0 ? (
            <EmptyState
              description="Stories aparecem aqui assim que forem vinculadas a esta feature (Story.featureId)."
              icon="kanban"
              title="Nenhuma story vinculada"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {f.stories.map((s) => (
                <StoryRow key={s.id} story={s} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
