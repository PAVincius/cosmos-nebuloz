import { describe, expect, it } from "vitest";
import {
  canAssignScaffoldRole,
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

  it("só consultor e administrador atribuem papel de adoção (SA-05)", () => {
    // Quem atribui papel decide quem pode fechar gate. Membro, dono e líder
    // não se promovem sozinhos.
    expect(scaffoldRolesGranting("membership.manage").sort()).toEqual([
      "ADMIN",
      "CONSULTANT",
    ]);
    expect(hasScaffoldPermission("TEAM_MEMBER", "membership.manage")).toBe(
      false
    );
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

describe("canAssignScaffoldRole (SA-05: sem escalada de privilégio)", () => {
  it("só ADMIN concede ADMIN", () => {
    expect(canAssignScaffoldRole("ADMIN", null, "ADMIN")).toBe(true);
    expect(canAssignScaffoldRole("CONSULTANT", null, "ADMIN")).toBe(false);
    expect(canAssignScaffoldRole("CONSULTANT", "TEAM_MEMBER", "ADMIN")).toBe(
      false
    );
  });

  it("só ADMIN retira ou rebaixa ADMIN", () => {
    expect(canAssignScaffoldRole("ADMIN", "ADMIN", "TEAM_MEMBER")).toBe(true);
    expect(canAssignScaffoldRole("CONSULTANT", "ADMIN", "TEAM_MEMBER")).toBe(
      false
    );
  });

  it("CONSULTANT gere só papéis abaixo dele, na ida e na volta", () => {
    for (const r of [
      "TEAM_MEMBER",
      "PROCESS_OWNER",
      "TRANSFORMATION_LEAD",
      "SPONSOR",
      "TEAM_LEAD",
    ] as const) {
      expect(canAssignScaffoldRole("CONSULTANT", null, r)).toBe(true);
      expect(canAssignScaffoldRole("CONSULTANT", r, "TEAM_MEMBER")).toBe(true);
    }
    // Igual não é abaixo: consultor não cria nem rebaixa consultor.
    expect(canAssignScaffoldRole("CONSULTANT", null, "CONSULTANT")).toBe(false);
    expect(
      canAssignScaffoldRole("CONSULTANT", "CONSULTANT", "TEAM_MEMBER")
    ).toBe(false);
  });

  it("papel sem membership.manage não atribui nada", () => {
    expect(canAssignScaffoldRole("TEAM_MEMBER", null, "TEAM_MEMBER")).toBe(
      false
    );
    expect(canAssignScaffoldRole("PROCESS_OWNER", null, "TEAM_MEMBER")).toBe(
      false
    );
  });
});

// SC-PO-04 / SC-DEV-07 — matriz do entregável (decisões do Norte, seção d).
describe("permissões de entregável", () => {
  const ESCRITA = [
    "deliverable.work",
    "deliverable.review",
    "deliverable.reopen",
    "deliverable.add",
  ] as const;

  it("SPONSOR e TEAM_LEAD só leem: escrita é negada (403 no backend)", () => {
    for (const role of ["SPONSOR", "TEAM_LEAD"] as const) {
      expect(hasScaffoldPermission(role, "deliverable.read")).toBe(true);
      expect(hasScaffoldPermission(role, "portfolio.read")).toBe(true);
      expect(hasScaffoldPermission(role, "artefact.read")).toBe(true);
      for (const p of ESCRITA) {
        expect(hasScaffoldPermission(role, p)).toBe(false);
      }
      expect(hasScaffoldPermission(role, "gate.close")).toBe(false);
      expect(hasScaffoldPermission(role, "step.complete")).toBe(false);
      expect(hasScaffoldPermission(role, "businesscase.sign")).toBe(false);
    }
  });

  it("todo papel lê entregável", () => {
    for (const role of Object.keys(SCAFFOLD_MATRIX)) {
      expect(
        hasScaffoldPermission(
          role as keyof typeof SCAFFOLD_MATRIX,
          "deliverable.read"
        )
      ).toBe(true);
    }
  });

  it("trabalhar: membro, dono, líder e consultora; ADMIN não", () => {
    expect(scaffoldRolesGranting("deliverable.work")).toEqual([
      "TEAM_MEMBER",
      "PROCESS_OWNER",
      "TRANSFORMATION_LEAD",
      "CONSULTANT",
    ]);
  });

  it("aprovar, reabrir e adicionar: dono, líder e consultora", () => {
    for (const p of [
      "deliverable.review",
      "deliverable.reopen",
      "deliverable.add",
    ] as const) {
      expect(scaffoldRolesGranting(p)).toEqual([
        "PROCESS_OWNER",
        "TRANSFORMATION_LEAD",
        "CONSULTANT",
      ]);
    }
  });

  it("reabrir vale o mesmo que fechar gate", () => {
    expect(scaffoldRolesGranting("deliverable.reopen")).toEqual(
      scaffoldRolesGranting("gate.close")
    );
  });

  it("ADMIN não mexe em entregável", () => {
    for (const p of ESCRITA) {
      expect(hasScaffoldPermission("ADMIN", p)).toBe(false);
    }
    expect(hasScaffoldPermission("ADMIN", "deliverable.read")).toBe(true);
  });
});

// SC-PM-04: métricas de produto do Scaffold numa tela da consultora. É leitura
// agregada da organização: consultoria e administração, não quem conduz trilha.
describe("product.metrics", () => {
  it("só consultor e administrador leem as métricas de produto", () => {
    expect(scaffoldRolesGranting("product.metrics").sort()).toEqual([
      "ADMIN",
      "CONSULTANT",
    ]);
  });

  it("líder, dono, membro, sponsor e team lead não", () => {
    for (const role of [
      "TRANSFORMATION_LEAD",
      "PROCESS_OWNER",
      "TEAM_MEMBER",
      "SPONSOR",
      "TEAM_LEAD",
    ] as const) {
      expect(hasScaffoldPermission(role, "product.metrics")).toBe(false);
    }
  });

  it("tem rótulo pt-BR e o motivo de negativa nomeia quem pode", () => {
    expect(SCAFFOLD_PERMISSION_LABEL["product.metrics"]).toBeTruthy();
    expect(scaffoldDenialReason("product.metrics")).toContain("Consultor");
  });
});

describe("publicar o método é da Nebuloz; overlay é do tenant", () => {
  // `template.publish` grava numa versão de template GLOBAL, sem tenantId: a
  // versão mais recente vira a base de toda trilha nova de TODAS as
  // organizações. Quem a tem altera o método do vizinho, então o admin de um
  // cliente não pode tê-la.
  it("só o consultor tem template.publish; o ADMIN do cliente não", () => {
    expect(scaffoldRolesGranting("template.publish")).toEqual(["CONSULTANT"]);
    expect(hasScaffoldPermission("ADMIN", "template.publish")).toBe(false);
  });

  // O overlay é a customização de UMA organização (tem tenantId). Salvar e
  // resolver conflito continuam com quem administra o tenant.
  it("overlay.manage é do ADMIN e do consultor, e de mais ninguém", () => {
    expect([...scaffoldRolesGranting("overlay.manage")].sort()).toEqual([
      "ADMIN",
      "CONSULTANT",
    ]);
  });

  it("overlay.manage tem rótulo", () => {
    expect(SCAFFOLD_PERMISSION_LABEL["overlay.manage"]).toBeTruthy();
  });
});
