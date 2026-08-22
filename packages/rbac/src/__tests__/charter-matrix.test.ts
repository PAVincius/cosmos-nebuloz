import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CharterRole } from "@repo/database";
import { describe, expect, it } from "vitest";
import {
  CHARTER_MATRIX,
  CHARTER_PERMISSION_LABEL,
  CHARTER_PERMISSIONS,
  CHARTER_ROLE_LABEL,
  CHARTER_ROLE_TONE,
  type CharterPermission,
  denialReason,
  hasCharterPermission,
  rolesGranting,
} from "../charter-matrix";

const ROLES = Object.keys(CHARTER_MATRIX) as CharterRole[];

function prismaEnumValues(schemaFile: string, enumName: string): string[] {
  const schema = readFileSync(
    join(__dirname, "../../../database/prisma/schema", schemaFile),
    "utf8"
  );
  const match = schema.match(new RegExp(`enum ${enumName} \\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`enum ${enumName} não encontrado em ${schemaFile}`);
  }
  return match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));
}

describe("CHARTER_MATRIX — cobertura de papéis", () => {
  it("tem uma linha para cada CharterRole do schema", () => {
    const enumRoles = prismaEnumValues("charter.prisma", "CharterRole");
    expect([...ROLES].sort()).toEqual([...enumRoles].sort());
  });

  it("rotula e dá tom a todo papel do enum", () => {
    for (const role of prismaEnumValues("charter.prisma", "CharterRole")) {
      expect(CHARTER_ROLE_LABEL[role as CharterRole]).toBeTruthy();
      expect(CHARTER_ROLE_TONE[role as CharterRole]).toBeTruthy();
    }
  });

  it("rotula toda permissão declarada", () => {
    for (const permission of CHARTER_PERMISSIONS) {
      expect(CHARTER_PERMISSION_LABEL[permission]).toBeTruthy();
    }
  });

  it("não concede nada fora de CHARTER_PERMISSIONS", () => {
    const declared = new Set<string>(CHARTER_PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of CHARTER_MATRIX[role]) {
        expect(declared.has(permission)).toBe(true);
      }
    }
  });
});

describe("governança não tem coringa", () => {
  // A decisão está escrita no topo de charter-matrix.ts: o ADMIN do tenant não
  // herda permissão de Charter, porque governança que o admin de plataforma
  // contorna não vale como evidência de auditoria. Um "*" aparecendo aqui
  // desmonta isso em silêncio.
  it("não tem coringa em nenhum papel", () => {
    for (const role of ROLES) {
      expect(CHARTER_MATRIX[role] as readonly string[]).not.toContain("*");
    }
  });

  it("não expõe ADMIN como papel de Charter", () => {
    expect(Object.keys(CHARTER_MATRIX)).not.toContain("ADMIN");
  });

  it("mantém EXEC e AUDITOR sem poder de decisão", () => {
    for (const role of ["EXEC", "AUDITOR"] as CharterRole[]) {
      expect(hasCharterPermission(role, "case.decide")).toBe(false);
      expect(hasCharterPermission(role, "policy.edit")).toBe(false);
      expect(hasCharterPermission(role, "policy.publish")).toBe(false);
      expect(hasCharterPermission(role, "vendor.approve")).toBe(false);
      expect(hasCharterPermission(role, "compliance.edit")).toBe(false);
    }
  });

  it("deixa REQUESTER só submeter", () => {
    expect(CHARTER_MATRIX.REQUESTER).toEqual(["case.submit"]);
  });

  it("só dá publicação de política a quem edita política", () => {
    for (const role of ROLES) {
      if (hasCharterPermission(role, "policy.publish")) {
        expect(hasCharterPermission(role, "policy.edit")).toBe(true);
      }
    }
  });
});

describe("rolesGranting", () => {
  it("devolve quem concede a permissão", () => {
    expect(rolesGranting("onboarding.publish").sort()).toEqual(
      ["COMPLIANCE", "HR"].sort()
    );
    expect(rolesGranting("compliance.edit")).toEqual(["COMPLIANCE"]);
  });

  // denialReason monta a frase com labels.pop(); lista vazia produziria
  // "Requer papel undefined". Permissão que ninguém exerce também é bug por
  // si só — está declarada e é inalcançável.
  it("garante que toda permissão tem pelo menos um papel", () => {
    for (const permission of CHARTER_PERMISSIONS) {
      expect(rolesGranting(permission).length).toBeGreaterThan(0);
    }
  });
});

describe("denialReason", () => {
  it("usa 'ou' entre os papéis e termina com o rótulo da permissão", () => {
    expect(denialReason("compliance.edit")).toBe(
      "Requer papel Compliance — Definir veredito de cobertura"
    );
    expect(denialReason("onboarding.publish")).toBe(
      "Requer papel Compliance ou People Ops — Publicar trilha de onboarding"
    );
  });

  it("nunca vaza undefined na frase", () => {
    for (const permission of CHARTER_PERMISSIONS) {
      expect(denialReason(permission)).not.toContain("undefined");
    }
  });

  it("lista três ou mais papéis com vírgula e 'ou' no último", () => {
    const permission: CharterPermission = "case.decide";
    expect(rolesGranting(permission).length).toBeGreaterThanOrEqual(3);
    expect(denialReason(permission)).toBe(
      "Requer papel Compliance, Legal ou Segurança — Decidir caso de uso"
    );
  });
});
