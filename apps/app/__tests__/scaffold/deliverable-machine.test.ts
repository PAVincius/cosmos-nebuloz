import { describe, expect, it } from "vitest";
import {
  type DeliverableStatus,
  type DeliverableTransition,
  decideTransition,
  deliverableGrants,
  gateReviewState,
} from "@/lib/scaffold/deliverable-machine";

// Máquina de estados do entregável — SC-DEV-03/05, SC-PO-03/04.
//
// Fluxo: Não iniciado → Em elaboração → Em revisão → Ajuste pedido / Aprovado →
// Reaberto. Pura de propósito: as actions só a chamam e gravam o resultado, e a
// regra fica testável sem banco.

const OWNER = "u-owner";
const APPROVER = "u-approver";

const subject = (status: DeliverableStatus, over = {}) => ({
  status,
  ownerId: OWNER,
  approverId: APPROVER,
  ...over,
});

const as = (role: string, userId: string) => ({
  userId,
  grants: deliverableGrants(role),
});

describe("transições válidas", () => {
  const CASES: {
    action: DeliverableTransition;
    from: DeliverableStatus;
    to: DeliverableStatus;
    role: string;
    userId: string;
    comment?: string;
  }[] = [
    {
      action: "START",
      from: "NOT_STARTED",
      to: "IN_PROGRESS",
      role: "CONSULTANT",
      userId: "u-c",
    },
    {
      action: "SUBMIT",
      from: "IN_PROGRESS",
      to: "IN_REVIEW",
      role: "CONSULTANT",
      userId: "u-c",
    },
    {
      action: "SUBMIT",
      from: "ADJUSTMENT_REQUESTED",
      to: "IN_REVIEW",
      role: "CONSULTANT",
      userId: "u-c",
    },
    {
      action: "SUBMIT",
      from: "REOPENED",
      to: "IN_REVIEW",
      role: "CONSULTANT",
      userId: "u-c",
    },
    {
      action: "APPROVE",
      from: "IN_REVIEW",
      to: "APPROVED",
      role: "PROCESS_OWNER",
      userId: APPROVER,
    },
    {
      action: "REQUEST_ADJUSTMENT",
      from: "IN_REVIEW",
      to: "ADJUSTMENT_REQUESTED",
      role: "PROCESS_OWNER",
      userId: APPROVER,
      comment: "Falta o volume por canal.",
    },
    {
      action: "REOPEN",
      from: "APPROVED",
      to: "REOPENED",
      role: "CONSULTANT",
      userId: "u-c",
      comment: "Baseline mudou.",
    },
  ];

  it.each(CASES)("$action: $from → $to", (c) => {
    const r = decideTransition(
      c.action,
      subject(c.from),
      as(c.role, c.userId),
      c.comment
    );
    expect(r).toEqual({ ok: true, to: c.to });
  });
});

describe("transições inválidas", () => {
  it.each([
    ["START", "IN_PROGRESS"],
    ["START", "APPROVED"],
    ["SUBMIT", "NOT_STARTED"],
    ["SUBMIT", "IN_REVIEW"],
    ["SUBMIT", "APPROVED"],
    ["APPROVE", "IN_PROGRESS"],
    ["APPROVE", "APPROVED"],
    ["REQUEST_ADJUSTMENT", "APPROVED"],
    ["REOPEN", "IN_REVIEW"],
    ["REOPEN", "NOT_STARTED"],
  ] as const)("%s a partir de %s é recusado", (action, from) => {
    const r = decideTransition(
      action,
      subject(from),
      as("CONSULTANT", APPROVER),
      "comentário"
    );
    expect(r).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });
});

describe("comentário obrigatório (SC-PO-03)", () => {
  it.each([
    "",
    "   ",
    undefined,
  ])("pedir ajuste sem comentário (%j) é recusado", (comment) => {
    const r = decideTransition(
      "REQUEST_ADJUSTMENT",
      subject("IN_REVIEW"),
      as("PROCESS_OWNER", APPROVER),
      comment
    );
    expect(r).toMatchObject({ ok: false, code: "COMMENT_REQUIRED" });
  });

  it.each([
    "",
    "  ",
    undefined,
  ])("reabrir sem comentário (%j) é recusado", (c) => {
    const r = decideTransition(
      "REOPEN",
      subject("APPROVED"),
      as("CONSULTANT", "u-c"),
      c
    );
    expect(r).toMatchObject({ ok: false, code: "COMMENT_REQUIRED" });
  });

  it("aprovar e enviar não exigem comentário", () => {
    expect(
      decideTransition(
        "APPROVE",
        subject("IN_REVIEW"),
        as("PROCESS_OWNER", APPROVER)
      )
    ).toEqual({ ok: true, to: "APPROVED" });
  });
});

describe("quem trabalha (work)", () => {
  it("membro do time e dono do processo só no que é deles", () => {
    for (const role of ["TEAM_MEMBER", "PROCESS_OWNER"]) {
      expect(
        decideTransition("START", subject("NOT_STARTED"), as(role, OWNER)).ok
      ).toBe(true);
      expect(
        decideTransition("START", subject("NOT_STARTED"), as(role, "u-outro"))
      ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    }
  });

  it("líder de transformação e consultor trabalham em qualquer um", () => {
    for (const role of ["TRANSFORMATION_LEAD", "CONSULTANT"]) {
      expect(
        decideTransition("START", subject("NOT_STARTED"), as(role, "u-x")).ok
      ).toBe(true);
    }
  });

  it.each([
    "ADMIN",
    "SPONSOR",
    "TEAM_LEAD",
  ])("%s recebe 403 em escrita", (role) => {
    for (const [action, status] of [
      ["START", "NOT_STARTED"],
      ["SUBMIT", "IN_PROGRESS"],
    ] as const) {
      expect(
        decideTransition(action, subject(status), as(role, OWNER))
      ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    }
  });

  it("entregável sem responsável só é trabalhado por quem trabalha em qualquer um", () => {
    const s = subject("NOT_STARTED", { ownerId: null });
    expect(
      decideTransition("START", s, as("TEAM_MEMBER", OWNER))
    ).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(decideTransition("START", s, as("CONSULTANT", "u-c")).ok).toBe(true);
  });
});

describe("quem revisa (review)", () => {
  it("só o aprovador designado aprova ou pede ajuste", () => {
    expect(
      decideTransition(
        "APPROVE",
        subject("IN_REVIEW"),
        as("CONSULTANT", "u-outro")
      )
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(
      decideTransition(
        "APPROVE",
        subject("IN_REVIEW"),
        as("CONSULTANT", APPROVER)
      ).ok
    ).toBe(true);
  });

  it("ninguém aprova o que é seu, nem sendo o aprovador designado", () => {
    const s = subject("IN_REVIEW", { approverId: OWNER });
    for (const role of ["PROCESS_OWNER", "TRANSFORMATION_LEAD", "CONSULTANT"]) {
      expect(decideTransition("APPROVE", s, as(role, OWNER))).toMatchObject({
        ok: false,
        code: "SELF_REVIEW",
      });
      expect(
        decideTransition("REQUEST_ADJUSTMENT", s, as(role, OWNER), "ajuste")
      ).toMatchObject({ ok: false, code: "SELF_REVIEW" });
    }
  });

  it.each([
    "TEAM_MEMBER",
    "ADMIN",
    "SPONSOR",
    "TEAM_LEAD",
  ])("%s não revisa, mesmo designado", (role) => {
    expect(
      decideTransition("APPROVE", subject("IN_REVIEW"), as(role, APPROVER))
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("sem aprovador designado, qualquer revisor que não seja o dono aprova", () => {
    const s = subject("IN_REVIEW", { approverId: null });
    expect(decideTransition("APPROVE", s, as("CONSULTANT", "u-c")).ok).toBe(
      true
    );
    expect(
      decideTransition("APPROVE", s, as("CONSULTANT", OWNER))
    ).toMatchObject({
      ok: false,
      code: "SELF_REVIEW",
    });
  });
});

describe("reabrir (reopen)", () => {
  it("dono do processo, líder e consultor reabrem", () => {
    for (const role of ["PROCESS_OWNER", "TRANSFORMATION_LEAD", "CONSULTANT"]) {
      expect(
        decideTransition(
          "REOPEN",
          subject("APPROVED"),
          as(role, "u-x"),
          "motivo"
        ).ok
      ).toBe(true);
    }
  });

  it.each([
    "TEAM_MEMBER",
    "ADMIN",
    "SPONSOR",
    "TEAM_LEAD",
  ])("%s não reabre", (role) => {
    expect(
      decideTransition("REOPEN", subject("APPROVED"), as(role, OWNER), "motivo")
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("gate Revisar e assinar (SG-01)", () => {
  const d = (code: string, status: DeliverableStatus, required = true) => ({
    code,
    title: `Entregável ${code}`,
    status,
    required,
  });

  it("libera quando todo obrigatório está aprovado", () => {
    expect(
      gateReviewState([d("A1.1", "APPROVED"), d("A1.2", "APPROVED")])
    ).toEqual({ blocked: false, reason: null, pending: [] });
  });

  it("bloqueia com o motivo e a lista dos obrigatórios pendentes", () => {
    const r = gateReviewState([
      d("A1.1", "APPROVED"),
      d("A1.2", "IN_REVIEW"),
      d("A2.1", "NOT_STARTED"),
    ]);
    expect(r.blocked).toBe(true);
    expect(r.pending.map((p) => p.code)).toEqual(["A1.2", "A2.1"]);
    expect(r.reason).toBe("2 entregáveis obrigatórios pendentes: A1.2, A2.1.");
  });

  it("singular quando falta um só", () => {
    expect(gateReviewState([d("A1.1", "REOPENED")]).reason).toBe(
      "1 entregável obrigatório pendente: A1.1."
    );
  });

  it("reaberto volta a bloquear", () => {
    expect(gateReviewState([d("A1.1", "REOPENED")]).blocked).toBe(true);
  });

  it("opcional pendente não bloqueia", () => {
    expect(
      gateReviewState([d("A1.1", "APPROVED"), d("X1", "NOT_STARTED", false)])
        .blocked
    ).toBe(false);
  });

  it("fase sem entregável obrigatório não é liberada por vazio", () => {
    // Zero obrigatórios = template sem entregáveis ou dado ausente. Liberar por
    // vazio esconderia o defeito; o gate diz o que falta.
    const r = gateReviewState([]);
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("A fase não tem entregável obrigatório cadastrado.");
  });
});
