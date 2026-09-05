import { describe, expect, it } from "vitest";
import {
  hasScaffoldPermission,
  SCAFFOLD_MATRIX,
  SCAFFOLD_PERMISSION_LABEL,
  SCAFFOLD_PERMISSIONS,
  SCAFFOLD_ROLE_LABEL,
  scaffoldDenialReason,
  scaffoldRolesGranting,
} from "../scaffold-matrix";

// Matriz do Scaffold. O que se testa aqui não é a tabela — é a separação que a
// tabela existe para manter.

describe("SCAFFOLD_MATRIX", () => {
  it("cobre todos os papéis", () => {
    expect(Object.keys(SCAFFOLD_MATRIX).sort()).toEqual(
      Object.keys(SCAFFOLD_ROLE_LABEL).sort()
    );
  });

  it("não concede permissão fora da lista canônica", () => {
    for (const perms of Object.values(SCAFFOLD_MATRIX)) {
      for (const p of perms) {
        expect(SCAFFOLD_PERMISSIONS).toContain(p);
      }
    }
  });

  it("toda permissão tem rótulo pt-BR", () => {
    for (const p of SCAFFOLD_PERMISSIONS) {
      expect(SCAFFOLD_PERMISSION_LABEL[p]).toBeTruthy();
    }
  });

  it("não tem coringa: nenhum papel concede tudo", () => {
    for (const perms of Object.values(SCAFFOLD_MATRIX)) {
      expect(perms.length).toBeLessThan(SCAFFOLD_PERMISSIONS.length);
    }
  });
});

describe("separações que o produto depende", () => {
  it("só o consultor faz override de gate", () => {
    expect(scaffoldRolesGranting("gate.override")).toEqual(["CONSULTANT"]);
  });

  it("ADMIN do tenant não fecha gate nem assina caso de negócio", () => {
    // Administrar acesso não é decidir risco. Se isto passar a valer, um admin
    // pode fechar a Fase 1 sem que ninguém com pele no processo tenha assinado.
    expect(hasScaffoldPermission("ADMIN", "gate.close")).toBe(false);
    expect(hasScaffoldPermission("ADMIN", "gate.override")).toBe(false);
    expect(hasScaffoldPermission("ADMIN", "businesscase.sign")).toBe(false);
  });

  it("quem redige o caso de negócio não é quem assina", () => {
    // A separação que faz SG-04 valer alguma coisa.
    expect(hasScaffoldPermission("CONSULTANT", "businesscase.write")).toBe(
      true
    );
    expect(hasScaffoldPermission("CONSULTANT", "businesscase.sign")).toBe(
      false
    );
    expect(hasScaffoldPermission("PROCESS_OWNER", "businesscase.sign")).toBe(
      true
    );
    expect(hasScaffoldPermission("PROCESS_OWNER", "businesscase.write")).toBe(
      false
    );
  });

  it("o dono do processo fecha gate mas não passa por cima do próprio critério", () => {
    expect(hasScaffoldPermission("PROCESS_OWNER", "gate.close")).toBe(true);
    expect(hasScaffoldPermission("PROCESS_OWNER", "gate.override")).toBe(false);
  });

  it("membro do time executa e lê, não decide", () => {
    expect(hasScaffoldPermission("TEAM_MEMBER", "step.complete")).toBe(true);
    expect(hasScaffoldPermission("TEAM_MEMBER", "gate.close")).toBe(false);
    expect(hasScaffoldPermission("TEAM_MEMBER", "track.manage")).toBe(false);
  });

  it("todo papel lê o portfólio — visibilidade não é privilégio", () => {
    for (const role of Object.keys(SCAFFOLD_MATRIX)) {
      expect(
        hasScaffoldPermission(
          role as keyof typeof SCAFFOLD_MATRIX,
          "portfolio.read"
        )
      ).toBe(true);
    }
  });
});

describe("scaffoldDenialReason", () => {
  it("nomeia quem pode e o que a permissão faz", () => {
    const reason = scaffoldDenialReason("gate.override");
    expect(reason).toContain("Consultor");
    expect(reason).toContain("justificativa");
  });

  it("lista múltiplos papéis com 'ou'", () => {
    expect(scaffoldDenialReason("gate.close")).toMatch(/ ou /);
  });
});
