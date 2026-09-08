import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasPermission,
  hasPermissions,
  PERMISSION_MATRIX,
  type Permission,
  type SaFeRole,
} from "../matrix";

const ROLES = Object.keys(PERMISSION_MATRIX) as SaFeRole[];

/** Lê os valores de um enum direto do schema Prisma. A alternativa seria
 *  importar o client gerado, que exige `prisma generate` e arrasta o runtime
 *  do Prisma para um teste de matriz pura. */
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

describe("PERMISSION_MATRIX — cobertura de papéis", () => {
  // Se alguém adicionar um papel ao enum e esquecer da matriz,
  // `PERMISSION_MATRIX[role]` vira undefined e `hasPermission` estoura com
  // TypeError em runtime — o papel vem de cast do banco em resolve.ts, não de
  // literal. Este teste é o que impede a matriz e o enum de divergirem.
  it("tem uma linha para cada MemberRole do schema", () => {
    const enumRoles = prismaEnumValues("tenant.prisma", "MemberRole");
    expect([...ROLES].sort()).toEqual([...enumRoles].sort());
  });

  it("nunca devolve undefined para um papel do enum", () => {
    for (const role of prismaEnumValues("tenant.prisma", "MemberRole")) {
      expect(PERMISSION_MATRIX[role as SaFeRole]).toBeDefined();
      expect(() => hasPermission(role as SaFeRole, "epic:read")).not.toThrow();
    }
  });
});

describe("hasPermission", () => {
  it("dá tudo ao ADMIN pelo coringa", () => {
    const everyPermission = [
      ...new Set(Object.values(PERMISSION_MATRIX).flat()),
    ].filter((p) => p !== "*");
    for (const permission of everyPermission) {
      expect(hasPermission("ADMIN", permission)).toBe(true);
    }
  });

  it("nega o que não está na linha do papel", () => {
    expect(hasPermission("DEV", "epic:write")).toBe(false);
    expect(hasPermission("DEV", "governance:approve")).toBe(false);
    expect(hasPermission("DEV", "budget:write")).toBe(false);
    expect(hasPermission("MEMBER", "story:write")).toBe(false);
    expect(hasPermission("PO", "governance:approve")).toBe(false);
    expect(hasPermission("SM", "budget:read")).toBe(false);
  });

  it("concede o que está na linha do papel", () => {
    expect(hasPermission("DEV", "story:write")).toBe(true);
    expect(hasPermission("PO", "wsjf:write")).toBe(true);
    expect(hasPermission("SM", "sprint:manage")).toBe(true);
    expect(hasPermission("RTE", "governance:approve")).toBe(true);
  });

  it("só o ADMIN tem coringa", () => {
    for (const role of ROLES.filter((r) => r !== "ADMIN")) {
      expect(PERMISSION_MATRIX[role]).not.toContain("*");
    }
  });

  // STE e RTE apontam para o mesmo array de propósito (matrix.ts:95-96).
  // Fixar aqui: se um dos dois ganhar permissão isolada no futuro, que seja
  // decisão explícita e não efeito colateral de editar a constante partilhada.
  it("trata STE e RTE como o mesmo conjunto", () => {
    expect(PERMISSION_MATRIX.STE).toEqual(PERMISSION_MATRIX.RTE);
  });
});

describe("hasPermissions", () => {
  it("exige todas, não alguma", () => {
    expect(hasPermissions("DEV", ["story:read", "story:write"])).toBe(true);
    expect(hasPermissions("DEV", ["story:read", "epic:write"])).toBe(false);
  });

  it("é verdadeiro para lista vazia — nada pedido, nada negado", () => {
    expect(hasPermissions("MEMBER", [])).toBe(true);
  });

  it("dá tudo ao ADMIN", () => {
    expect(
      hasPermissions("ADMIN", ["epic:write", "budget:write", "art:manage"])
    ).toBe(true);
  });
});

describe("menor privilégio", () => {
  it("mantém MEMBER só em leitura", () => {
    const writeish = PERMISSION_MATRIX.MEMBER.filter(
      (p: Permission) =>
        p.endsWith(":write") ||
        p.endsWith(":manage") ||
        p.endsWith(":approve") ||
        p.endsWith(":transition")
    );
    expect(writeish).toEqual([]);
  });

  it("não deixa DEV nem SM aprovarem governança ou mexerem em orçamento", () => {
    for (const role of ["DEV", "SM", "MEMBER"] as SaFeRole[]) {
      expect(hasPermission(role, "governance:approve")).toBe(false);
      expect(hasPermission(role, "budget:write")).toBe(false);
      expect(hasPermission(role, "art:manage")).toBe(false);
    }
  });

  it("não repete permissão dentro de um papel", () => {
    for (const role of ROLES) {
      const perms = PERMISSION_MATRIX[role];
      expect(new Set(perms).size).toBe(perms.length);
    }
  });
});
