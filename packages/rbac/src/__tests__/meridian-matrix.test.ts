import { describe, expect, it } from "vitest";
import {
  hasMeridianPermission,
  MERIDIAN_MATRIX,
  MERIDIAN_PERMISSIONS,
  meridianDenialReason,
  meridianRolesGranting,
} from "../meridian-matrix";

// A matriz é a transcrição de R-02. Célula vazia = negado, e nada é implícito:
// um papel novo entra com lista vazia, não com herança.

describe("MERIDIAN_MATRIX", () => {
  it("dá ao consultor todas as permissões", () => {
    expect([...MERIDIAN_MATRIX.CONSULTANT].sort()).toEqual(
      [...MERIDIAN_PERMISSIONS].sort()
    );
  });

  it("dá ao revisor decisão de score e leitura de evidência, nada mais", () => {
    expect([...MERIDIAN_MATRIX.REVIEWER].sort()).toEqual([
      "evidence.read",
      "override.write",
      "report.read",
    ]);
  });

  it("dá ao leitor apenas o relatório", () => {
    expect([...MERIDIAN_MATRIX.VIEWER]).toEqual(["report.read"]);
  });

  it("não dá override ao leitor", () => {
    expect(hasMeridianPermission("VIEWER", "override.write")).toBe(false);
  });

  it("não dá promoção ao revisor — promover cria trabalho em outro produto", () => {
    expect(hasMeridianPermission("REVIEWER", "gap.promote")).toBe(false);
  });

  it("não tem coringa: toda permissão da matriz existe na lista canônica", () => {
    for (const perms of Object.values(MERIDIAN_MATRIX)) {
      for (const p of perms) {
        expect(MERIDIAN_PERMISSIONS).toContain(p);
      }
    }
  });
});

describe("meridianRolesGranting", () => {
  it("lista os papéis que concedem a permissão", () => {
    expect(meridianRolesGranting("override.write")).toEqual([
      "CONSULTANT",
      "REVIEWER",
    ]);
  });

  it("lista só o consultor para promoção", () => {
    expect(meridianRolesGranting("gap.promote")).toEqual(["CONSULTANT"]);
  });
});

describe("meridianDenialReason", () => {
  it("nomeia os papéis em pt-BR — quem não pode agir precisa saber a quem pedir", () => {
    const reason = meridianDenialReason("override.write");
    expect(reason).toContain("Consultor");
    expect(reason).toContain("Revisor");
    expect(reason).toContain("override");
  });

  it("não usa conector quando só um papel concede", () => {
    expect(meridianDenialReason("gap.promote")).toContain(
      "Requer papel Consultor"
    );
  });
});
