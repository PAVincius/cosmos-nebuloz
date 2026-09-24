/** @vitest-environment jsdom */
// audit-log-table.test.tsx — P2 do dogfood do Meridian (atrito.md, M8):
// (1) FR-038 exige ver antes/depois do override na trilha. O Meridian grava
// diff como Array<[campo, antes, depois]> de propósito (_shared.ts:14,
// documentado como deliberadamente diferente do Record<string,unknown> do
// Cosmos) — a tela genérica precisa ler os dois formatos.
// (2) sem coluna de alvo legível (só entityId cuid) — `metadata.target` já é
// gravado por `logMeridianAudit`, a tela só não lê.
// (3) o filtro não lista entityType do Meridian nem aceita prefixo.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditLogTable } from "@/app/(authenticated)/settings/audit/components/audit-log-table";
import type { AuditLog } from "@/app/actions/audit/schema";

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "log-1",
    tenantId: "t-1",
    userId: "u-1",
    action: "updated",
    entityType: "Epic",
    entityId: "cltest0000000000000000001",
    diff: null,
    metadata: null,
    createdAt: new Date("2026-09-24T12:00:00Z"),
    ...overrides,
  };
}

describe("AuditLogTable — formatDiff", () => {
  it("reads a Cosmos Record diff as field: value", async () => {
    const log = makeLog({ diff: { status: "done" } });
    render(
      <AuditLogTable entityType={undefined} logs={[log]} periodDays={7} />
    );

    expect(await screen.findByText("status: done")).toBeTruthy();
  });

  it("reads a Meridian [campo, antes, depois] array diff as field: before → after (FR-038)", async () => {
    const log = makeLog({
      entityType: "meridian.override",
      diff: [["Score final", "50", "30"]],
    });
    render(
      <AuditLogTable entityType={undefined} logs={[log]} periodDays={7} />
    );

    expect(await screen.findByText("Score final: 50 → 30")).toBeTruthy();
    // Não deve regredir pro bug antigo (Object.entries por índice).
    expect(screen.queryByText(/^0: Score final/)).toBeNull();
  });

  it("renders — for an empty diff array", () => {
    const log = makeLog({ diff: [] });
    render(
      <AuditLogTable entityType={undefined} logs={[log]} periodDays={7} />
    );

    expect(screen.getByText("—")).toBeTruthy();
  });
});

describe("AuditLogTable — coluna de alvo legível", () => {
  it("shows metadata.target instead of the raw entityId when present", () => {
    const log = makeLog({
      entityType: "meridian.assessment",
      entityId: "cltest0000000000000000009",
      metadata: { target: "AS-200 · Solaris Digital" },
    });
    render(
      <AuditLogTable entityType={undefined} logs={[log]} periodDays={7} />
    );

    expect(screen.getByText("AS-200 · Solaris Digital")).toBeTruthy();
    expect(screen.queryByText("cltest0000000000000000009")).toBeNull();
  });

  it("falls back to entityId when metadata.target is absent", () => {
    const log = makeLog({
      entityId: "cltest0000000000000000009",
      metadata: null,
    });
    render(
      <AuditLogTable entityType={undefined} logs={[log]} periodDays={7} />
    );

    expect(screen.getByText("cltest0000000000000000009")).toBeTruthy();
  });
});

describe("AuditLogTable — filtro por prefixo", () => {
  it("offers a Meridian filter pill that links to the meridian. prefix", () => {
    render(<AuditLogTable entityType={undefined} logs={[]} periodDays={7} />);

    const link = screen.getByRole("link", { name: "Meridian" });
    expect(link.getAttribute("href")).toContain("entityType=meridian.");
  });
});
