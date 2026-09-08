import type { SignalRole } from "@repo/database";
import { describe, expect, it } from "vitest";
// Import direto do módulo, não do barrel: `@repo/rbac` reexporta os resolvers,
// que importam `@repo/database` e disparam a guarda de env de servidor. A
// matriz é pura e não precisa de banco para ser testada.
import {
  hasSignalPermission,
  ownsOrOutranksInitiative,
  SIGNAL_MATRIX,
  SIGNAL_PERMISSIONS,
  type SignalPermission,
  signalDenialReason,
  signalRolesGranting,
} from "../signal-matrix";

// Matriz papel × permissão do Signal.
//
// O teste transcreve `contracts/server-actions.md` de novo, de propósito: se a
// matriz e o contrato divergirem, um dos dois está errado e a falha tem de
// apontar qual célula. Reusar SIGNAL_MATRIX para gerar as expectativas
// provaria apenas que a matriz é igual a si mesma.

const ROLES: SignalRole[] = ["VIEWER", "OWNER", "ANALYST", "ADMIN"];

/** Célula marcada = concedido. Cópia literal da tabela do contrato. */
const EXPECTED: Record<SignalPermission, SignalRole[]> = {
  "signal.read": ["VIEWER", "OWNER", "ANALYST", "ADMIN"],
  "signal.initiative.write": ["OWNER", "ANALYST", "ADMIN"],
  "signal.baseline.write": ["OWNER", "ANALYST", "ADMIN"],
  "signal.evidence.write": ["OWNER", "ANALYST", "ADMIN"],
  "signal.mapping.write": ["ANALYST", "ADMIN"],
  "signal.formula.write": ["ANALYST", "ADMIN"],
  "signal.alert.write": ["ANALYST", "ADMIN"],
  "signal.report.write": ["ANALYST", "ADMIN"],
  "signal.connection.write": ["ADMIN"],
  "signal.report.freeze": ["ADMIN"],
  "signal.initiative.close": ["ADMIN"],
  "signal.settings.write": ["ADMIN"],
  "signal.member.write": ["ADMIN"],
};

describe("matriz de permissões do Signal", () => {
  it("cobre exatamente as 13 permissões do contrato", () => {
    expect([...SIGNAL_PERMISSIONS].sort()).toEqual(
      Object.keys(EXPECTED).sort()
    );
  });

  it.each(ROLES)("concede a %s exatamente o que o contrato prevê", (role) => {
    const granted = SIGNAL_PERMISSIONS.filter((p) =>
      hasSignalPermission(role, p)
    );
    const expected = SIGNAL_PERMISSIONS.filter((p) =>
      EXPECTED[p].includes(role)
    );
    expect([...granted].sort()).toEqual([...expected].sort());
  });

  it("nega tudo para quem não tem papel — default deny, sem exceção para admin de tenant", () => {
    for (const permission of SIGNAL_PERMISSIONS) {
      expect(hasSignalPermission(null, permission)).toBe(false);
      expect(hasSignalPermission(undefined, permission)).toBe(false);
    }
  });

  it("não tem coringa: nenhum papel concede tudo por herança implícita", () => {
    // ADMIN concede tudo por enumeração explícita, e é o único. O teste existe
    // para falhar se alguém introduzir "*" na matriz.
    for (const role of ROLES) {
      expect(SIGNAL_MATRIX[role]).not.toContain("*");
    }
    expect(SIGNAL_MATRIX.ADMIN).toHaveLength(SIGNAL_PERMISSIONS.length);
  });

  it("é cumulativa: cada papel concede tudo do anterior", () => {
    const ladder: SignalRole[] = ["VIEWER", "OWNER", "ANALYST", "ADMIN"];
    for (let i = 1; i < ladder.length; i++) {
      const lower = SIGNAL_MATRIX[ladder[i - 1] as SignalRole];
      const higher = SIGNAL_MATRIX[ladder[i] as SignalRole];
      for (const permission of lower) {
        expect(higher).toContain(permission);
      }
    }
  });

  it("lista os papéis que concedem uma permissão, para o texto do 'peça a quem'", () => {
    expect(signalRolesGranting("signal.report.freeze")).toEqual(["ADMIN"]);
    expect(signalRolesGranting("signal.mapping.write")).toEqual([
      "ANALYST",
      "ADMIN",
    ]);
  });
});

describe("motivo da negativa", () => {
  it("é nulo quando a permissão existe", () => {
    expect(signalDenialReason("ADMIN", "signal.report.freeze")).toBeNull();
  });

  it("nomeia a permissão e quem a concede", () => {
    const reason = signalDenialReason("ANALYST", "signal.report.freeze");
    expect(reason).toContain("Analista");
    expect(reason).toContain("Congelar relatório");
    expect(reason).toContain("Administrador");
  });

  it("explica a ausência de papel sem confundir com falta de permissão", () => {
    const reason = signalDenialReason(null, "signal.read");
    expect(reason).toContain("não tem papel no Signal");
  });
});

describe("posse de iniciativa", () => {
  const OWNER_ID = "usr_owner";
  const OTHER_ID = "usr_other";

  it("deixa o OWNER escrever só na própria iniciativa", () => {
    expect(ownsOrOutranksInitiative("OWNER", OWNER_ID, OWNER_ID)).toBe(true);
    expect(ownsOrOutranksInitiative("OWNER", OTHER_ID, OWNER_ID)).toBe(false);
  });

  it("deixa ANALYST e ADMIN escreverem em qualquer uma", () => {
    expect(ownsOrOutranksInitiative("ANALYST", OTHER_ID, OWNER_ID)).toBe(true);
    expect(ownsOrOutranksInitiative("ADMIN", OTHER_ID, OWNER_ID)).toBe(true);
  });

  it("nega o VIEWER mesmo na própria iniciativa — ler não é escrever", () => {
    expect(ownsOrOutranksInitiative("VIEWER", OWNER_ID, OWNER_ID)).toBe(false);
  });

  it("nega quem não tem papel", () => {
    expect(ownsOrOutranksInitiative(null, OWNER_ID, OWNER_ID)).toBe(false);
  });
});
