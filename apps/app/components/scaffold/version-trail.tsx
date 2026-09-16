"use client";

// Histórico de versões do caso de negócio. Assinado é imutável — alteração
// cria versão, e a trilha mostra cada uma com quem assinou e a referência.

import { Icon } from "@repo/design-system/cosmos/icons";
import { SectionCard } from "@repo/design-system/cosmos/kit";
import type { BusinessCaseDetail } from "@/app/(scaffold)/actions/business-case";
import { BC_STATE } from "./screens/baselines";

export function VersionTrail({ bc }: { bc: BusinessCaseDetail }) {
  return (
    <SectionCard
      icon="history"
      subtitle="Assinado é imutável — alteração cria versão"
      title="Histórico de versões"
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {bc.versions.map((v, i) => {
          const s = BC_STATE[v.state] ?? BC_STATE.DRAFT;
          const last = i === bc.versions.length - 1;
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
                    background: `var(--${s?.tone}-soft)`,
                    color: `var(--${s?.tone}-text)`,
                    border: `1px solid rgba(var(--${s?.tone}-rgb),.35)`,
                  }}
                >
                  <Icon
                    name={v.state === "SIGNED" ? "lock" : "fileText"}
                    size={12}
                    strokeWidth={2.2}
                  />
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
                  <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                    {(v.signedAt ?? v.authoredAt).toLocaleDateString("pt-BR")}
                    {v.signedByLabel ? ` · ${v.signedByLabel}` : ""}
                  </span>
                  {v.contentHash && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        padding: "1px 6px",
                        borderRadius: 99,
                        background: "var(--chip-bg)",
                        color: "var(--ink-faint)",
                      }}
                    >
                      ref {v.contentHash}
                    </span>
                  )}
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
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
