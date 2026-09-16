"use client";

// modals/clause-library.tsx — ClauseLibraryModal (FR-9.5). Movido de
// modals.tsx no split em um arquivo por modal; anatomia preservada 1:1.

import { Badge, Button } from "@repo/design-system/cosmos/kit";
import type { ClauseLibraryRow } from "@/app/(charter)/actions/vendors";
import { TableHead, TableRow } from "../base";
import { Callout, FooterHint, Kbd } from "../form-kit";
import { ModalShell } from "../modal";

// ── 9. ClauseLibraryModal (FR-9.5) ────────────────────────────────────────────

export function ClauseLibraryModal({
  rows,
  onClose,
}: {
  rows: ClauseLibraryRow[];
  onClose: () => void;
}) {
  const critical = rows.filter((c) => c.critical).length;
  const cols = "70px minmax(0,1fr) 110px 96px";
  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> fechar · {critical} de {rows.length} são críticas
          </FooterHint>
          <Button onClick={onClose} size="md" variant="secondary">
            Fechar
          </Button>
        </>
      }
      icon="book"
      onClose={onClose}
      subtitle="O que o Charter exige de todo contrato de IA"
      title="Biblioteca de cláusulas"
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
        <Callout icon="scale" tone="accent">
          Cláusula crítica ausente não é observação — é limite operacional. O
          fornecedor fica travado na classe de dado que a postura atual
          sustenta.
        </Callout>
        <div
          style={{
            borderRadius: 9,
            border: "1px solid var(--hairline)",
            overflow: "hidden",
          }}
        >
          <TableHead
            cols={cols}
            labels={["ID", "Cláusula", "Tipo", "Cobertura"]}
          />
          {rows.map((c, i) => (
            <TableRow cols={cols} key={c.code} last={i === rows.length - 1}>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                }}
              >
                {c.code}
              </span>
              <span
                style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}
              >
                {c.name}
              </span>
              <Badge tone={c.critical ? "red" : "accent"}>
                {c.critical ? "Crítica" : "Recomendada"}
              </Badge>
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    c.covered === c.total
                      ? "var(--green-text)"
                      : c.covered === 0
                        ? "var(--red-text)"
                        : "var(--amber-text)",
                }}
              >
                {c.covered}/{c.total}
              </span>
            </TableRow>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
