"use client";

// Fila de revisão global — US3. Port de `meridian-screens-3.jsx`.
//
// Eixos contestados de toda a carteira num lugar só: a discordância não espera
// alguém abrir o assessment certo.

import { Icon } from "@repo/design-system/cosmos/icons";
import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  listReviewQueue,
  type QueueItem,
} from "@/app/(meridian)/actions/scoring";
import { AXES } from "@/lib/meridian/axes";
import {
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  useMeridianData,
} from "../base";

export default function QueueScreen() {
  const router = useRouter();
  const fetcher = useCallback(() => listReviewQueue(), []);
  const { data, loading, error, reload } =
    useMeridianData<QueueItem[]>(fetcher);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const items = data ?? [];
  const open = (id: string) => router.push(`/meridian/assessment/${id}`);

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Diagnose · revisão"
        subtitle="Eixos contestados de toda a carteira — discordância acima do limiar vai direto para cá."
        title="Fila de revisão"
        tone="amber"
      />

      {loading ? (
        <SkeletonCard />
      ) : items.length === 0 ? (
        <SmartEmptyState
          icon="check"
          subtitle="Nenhum eixo contestado aguardando revisão."
          title="Fila limpa"
          tone="green"
        />
      ) : (
        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 9 }}
          icon="gavel"
          title={
            items.length === 1
              ? "1 eixo aguardando julgamento"
              : `${items.length} eixos aguardando julgamento`
          }
          tone="amber"
        >
          {items.map((it) => (
            <button
              aria-label={`Revisar ${AXES[it.axis].label} de ${it.orgName}`}
              className="btn navitem"
              key={`${it.assessmentId}-${it.axis}`}
              onClick={() => open(it.assessmentId)}
              style={{
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: "var(--r-md)",
                border: "1px solid rgba(var(--amber-rgb),.35)",
                background: "var(--amber-soft)",
                cursor: "pointer",
              }}
              type="button"
            >
              <Icon
                name={AXES[it.axis].icon}
                size={16}
                style={{ color: "var(--amber-text)", flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{ display: "block", fontSize: 13, fontWeight: 800 }}
                >
                  {it.orgName} — {AXES[it.axis].label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: "var(--ink-subtle)",
                    fontWeight: 500,
                    lineHeight: 1.5,
                  }}
                >
                  {it.note ?? "Discordância acima do limiar do template."}
                </span>
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--amber-text)",
                  flexShrink: 0,
                }}
              >
                spread {it.spread}
              </span>
              <Icon
                name="arrowRight"
                size={14}
                style={{ color: "var(--ink-faint)" }}
              />
            </button>
          ))}
        </SectionCard>
      )}
    </div>
  );
}
