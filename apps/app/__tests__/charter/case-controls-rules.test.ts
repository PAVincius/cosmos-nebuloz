import { describe, expect, it } from "vitest";
import {
  ControlTransitionError,
  caseDecisionBlockers,
  controlProgress,
  expiresAtFor,
  isTenantFileKey,
  MAX_DISPENSE_DAYS,
  nextControlState,
  partitionByClass,
} from "@/lib/charter/case-controls";

// CH-PO-03 (classe mínima), CH-PO-04 (dispensa), CH-DEV-02/03/06 e a tabela de
// fluxo do PDF §04:
//   Sem evidência → Em elaboração → Em revisão → Ajuste pedido / Aceita → Vencida
//   Sem evidência / Ajuste pedido → Dispensado ; Aceita / Dispensado → Reaberto

const ctl = (over: Record<string, unknown> = {}) => ({
  code: "TR-1",
  minClass: "PUBLIC",
  ...over,
});

describe("partitionByClass (CH-PO-03)", () => {
  const controls = [
    ctl({ code: "P", minClass: "PUBLIC" }),
    ctl({ code: "I", minClass: "INTERNAL" }),
    ctl({ code: "C", minClass: "CONFIDENTIAL" }),
    ctl({ code: "R", minClass: "RESTRICTED" }),
  ] as never[];

  it("classe do caso >= classe mínima => aplica (PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED)", () => {
    const r = partitionByClass(controls, "INTERNAL");
    expect(r.applicable.map((c: { code: string }) => c.code)).toEqual([
      "P",
      "I",
    ]);
    expect(r.notApplicable.map((c: { code: string }) => c.code)).toEqual([
      "C",
      "R",
    ]);
  });

  it("RESTRICTED aplica tudo; PUBLIC só os PUBLIC", () => {
    expect(partitionByClass(controls, "RESTRICTED").notApplicable).toHaveLength(
      0
    );
    expect(
      partitionByClass(controls, "PUBLIC").applicable.map(
        (c: { code: string }) => c.code
      )
    ).toEqual(["P"]);
  });

  it("o RIPD (CONFIDENTIAL) entra a partir de dado confidencial e não em interno", () => {
    const ripd = [ctl({ code: "CV-4", minClass: "CONFIDENTIAL" })] as never[];
    expect(partitionByClass(ripd, "INTERNAL").applicable).toHaveLength(0);
    expect(partitionByClass(ripd, "CONFIDENTIAL").applicable).toHaveLength(1);
    expect(partitionByClass(ripd, "RESTRICTED").applicable).toHaveLength(1);
  });
});

describe("nextControlState — fluxo do PDF", () => {
  it.each([
    ["NO_EVIDENCE", "ATTACH", "IN_PROGRESS"],
    ["IN_PROGRESS", "ATTACH", "IN_PROGRESS"],
    ["ADJUSTMENT_REQUESTED", "ATTACH", "IN_PROGRESS"],
    ["REOPENED", "ATTACH", "IN_PROGRESS"],
    ["EXPIRED", "ATTACH", "IN_PROGRESS"],
    ["IN_PROGRESS", "SUBMIT", "IN_REVIEW"],
    ["IN_REVIEW", "ACCEPT", "ACCEPTED"],
    ["IN_REVIEW", "REQUEST_ADJUSTMENT", "ADJUSTMENT_REQUESTED"],
    ["NO_EVIDENCE", "DISPENSE", "DISPENSED"],
    ["ADJUSTMENT_REQUESTED", "DISPENSE", "DISPENSED"],
    ["ACCEPTED", "REOPEN", "REOPENED"],
    ["DISPENSED", "REOPEN", "REOPENED"],
    ["ACCEPTED", "EXPIRE", "EXPIRED"],
  ] as const)("%s + %s => %s", (from, action, to) => {
    expect(nextControlState(from, action)).toBe(to);
  });

  it.each([
    ["NO_EVIDENCE", "SUBMIT"],
    ["NO_EVIDENCE", "ACCEPT"],
    ["IN_PROGRESS", "ACCEPT"],
    ["IN_PROGRESS", "DISPENSE"],
    ["IN_REVIEW", "DISPENSE"],
    ["IN_REVIEW", "REOPEN"],
    ["ACCEPTED", "ATTACH"],
    ["ACCEPTED", "DISPENSE"],
    ["DISPENSED", "ATTACH"],
    ["DISPENSED", "ACCEPT"],
    ["EXPIRED", "ACCEPT"],
    ["IN_REVIEW", "EXPIRE"],
    ["NO_EVIDENCE", "REQUEST_ADJUSTMENT"],
  ] as const)("%s + %s é recusado", (from, action) => {
    expect(() => nextControlState(from, action)).toThrow(
      ControlTransitionError
    );
  });
});

describe("expiresAtFor (cadência)", () => {
  const at = new Date("2026-01-31T12:00:00.000Z");

  it.each([
    ["WEEKLY", "2026-02-07T12:00:00.000Z"],
    ["MONTHLY", "2026-02-28T12:00:00.000Z"],
    ["QUARTERLY", "2026-04-30T12:00:00.000Z"],
    ["SEMIANNUAL", "2026-07-31T12:00:00.000Z"],
    ["ANNUAL", "2027-01-31T12:00:00.000Z"],
  ] as const)("%s", (cadence, expected) => {
    expect(expiresAtFor(cadence, at)?.toISOString()).toBe(expected);
  });

  it("por ciclo não vence por calendário", () => {
    expect(expiresAtFor("PER_CYCLE", at)).toBeNull();
  });
});

describe("caseDecisionBlockers (CH-DEV-06)", () => {
  const c = (code: string, state: string) => ({ code, name: code, state });

  it("bloqueiam: sem evidência, ajuste pedido, vencido e reaberto", () => {
    const blockers = caseDecisionBlockers([
      c("A", "NO_EVIDENCE"),
      c("B", "ADJUSTMENT_REQUESTED"),
      c("C", "EXPIRED"),
      c("D", "REOPENED"),
    ] as never[]);
    expect(blockers.map((b: { code: string }) => b.code)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("não bloqueiam: em elaboração, em revisão, aceita, dispensada", () => {
    const blockers = caseDecisionBlockers([
      c("A", "IN_PROGRESS"),
      c("B", "IN_REVIEW"),
      c("C", "ACCEPTED"),
      c("D", "DISPENSED"),
    ] as never[]);
    expect(blockers).toEqual([]);
  });

  it("cada bloqueio traz o motivo em português", () => {
    const [b] = caseDecisionBlockers([c("TR-2", "EXPIRED")] as never[]);
    expect(b.reason).toMatch(/venc/i);
  });
});

describe("controlProgress", () => {
  it("X/Y com evidência aceita, contando dispensados à parte", () => {
    const p = controlProgress([
      { state: "ACCEPTED" },
      { state: "ACCEPTED" },
      { state: "IN_REVIEW" },
      { state: "DISPENSED" },
      { state: "NO_EVIDENCE" },
    ] as never[]);
    expect(p).toEqual({ accepted: 2, total: 5, dispensed: 1 });
  });
});

describe("MAX_DISPENSE_DAYS (CH-PO-04, hipótese do Norte)", () => {
  it("prazo máximo de dispensa é de 6 meses", () => {
    expect(MAX_DISPENSE_DAYS).toBeGreaterThanOrEqual(180);
    expect(MAX_DISPENSE_DAYS).toBeLessThanOrEqual(186);
  });
});

describe("isTenantFileKey (IDOR em chave de arquivo)", () => {
  it("aceita chave do próprio tenant, com subpastas", () => {
    expect(isTenantFileKey("t1", "t1/evidencias/rollback.pdf")).toBe(true);
    expect(isTenantFileKey("t1", "t1/a.pdf")).toBe(true);
    expect(isTenantFileKey("t1", "t1/2026/09/relatorio-v2_final.pdf")).toBe(
      true
    );
  });

  it("recusa chave de outro tenant", () => {
    expect(isTenantFileKey("t1", "t2/a.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t10/a.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1x/a.pdf")).toBe(false);
  });

  it("recusa travessia com '..' (A/../B/x.pdf começa com A/ mas resolve em B)", () => {
    expect(isTenantFileKey("t1", "t1/../t2/x.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1/evidencias/../../t2/x.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1/..")).toBe(false);
  });

  it("recusa '.' como segmento, '//' e '\\'", () => {
    expect(isTenantFileKey("t1", "t1/./x.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1//x.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1/evidencias\\x.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1\\x.pdf")).toBe(false);
  });

  it("recusa chave vazia depois do tenant, terminada em '/' ou com caractere fora do conjunto", () => {
    expect(isTenantFileKey("t1", "t1/")).toBe(false);
    expect(isTenantFileKey("t1", "t1")).toBe(false);
    expect(isTenantFileKey("t1", "t1/a b.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1/a%2e%2e/x.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1/a?b.pdf")).toBe(false);
    expect(isTenantFileKey("t1", "t1/x.pdf\n")).toBe(false);
  });

  it("não deixa o tenantId virar regex", () => {
    expect(isTenantFileKey("t.1", "tX1/a.pdf")).toBe(false);
    expect(isTenantFileKey("t.1", "t.1/a.pdf")).toBe(true);
    expect(isTenantFileKey("t1|t2", "t2/a.pdf")).toBe(false);
  });
});
