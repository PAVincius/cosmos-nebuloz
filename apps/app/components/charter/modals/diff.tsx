"use client";

// modals/diff.tsx — DiffModal (FR-2.6). Movido de modals.tsx no split em um
// arquivo por modal; anatomia preservada 1:1.

import { Button } from "@repo/design-system/cosmos/kit";
import type { VersionDiff } from "@/app/(charter)/actions/policy";
import { TableHead } from "../base";
import { Callout, FooterHint, Kbd } from "../form-kit";
import { ModalShell } from "../modal";

// ── 6. DiffModal (FR-2.6) ─────────────────────────────────────────────────────

export function DiffModal({
  diff,
  publishedBy,
  publishedAt,
  summary,
  onClose,
}: {
  diff: VersionDiff;
  publishedBy: string | null;
  publishedAt: string;
  summary: string;
  onClose: () => void;
}) {
  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> fechar · Referência imutável ao registro de origem
          </FooterHint>
          <Button onClick={onClose} size="md" variant="secondary">
            Fechar
          </Button>
        </>
      }
      icon="eye"
      onClose={onClose}
      subtitle={`${publishedBy ?? "—"} · ${new Date(publishedAt).toLocaleDateString("pt-BR")}`}
      title={`Diff · ${diff.version}`}
      tone="accent"
      width={720}
    >
      <div
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Callout icon="fileText" tone="accent">
          {summary}
        </Callout>
        {diff.rows.length === 0 ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-muted)",
              padding: "20px 0",
              textAlign: "center",
            }}
          >
            Nenhuma diferença de conteúdo entre esta versão e a anterior.
          </div>
        ) : (
          <div
            style={{
              borderRadius: 9,
              border: "1px solid var(--hairline)",
              overflow: "hidden",
            }}
          >
            <TableHead cols="1fr 1fr" labels={["Antes", "Depois"]} />
            {diff.rows.map((r, i, arr) => (
              <div
                key={r.field}
                style={{
                  borderBottom:
                    i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: 8,
                  }}
                >
                  {r.field}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--red-text)",
                      background: "var(--red-soft)",
                      padding: "8px 10px",
                      borderRadius: 7,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.before}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--green-text)",
                      background: "var(--green-soft)",
                      padding: "8px 10px",
                      borderRadius: 7,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.after}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
