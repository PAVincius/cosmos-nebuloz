// rotulos.test.ts — um lugar para o nome e o tom de plano e de status de
// módulo. A carteira mostrava "COSMOS · Ativo" e Contas "vanta · GALAXY":
// o enum do banco na tela, e cada tela com a sua cópia do mapa.
import { describe, expect, it } from "vitest";
import {
  plano,
  ROTULO_DO_MODULO,
  rotuloDoModulo,
  statusDoModulo,
} from "@/lib/rotulos";

describe("plano", () => {
  it("os quatro do enum SubscriptionPlan, com tom que sobe com o plano", () => {
    expect(plano("ORBIT")).toEqual({ rotulo: "Orbit", tom: "neutral" });
    expect(plano("GALAXY")).toEqual({ rotulo: "Galaxy", tom: "blue" });
    expect(plano("NEBULA")).toEqual({ rotulo: "Nebula", tom: "purple" });
    expect(plano("UNIVERSE")).toEqual({ rotulo: "Universe", tom: "accent" });
  });

  it("plano fora do mapa aparece como veio, em vez de sumir", () => {
    expect(plano("QUASAR")).toEqual({ rotulo: "QUASAR", tom: "neutral" });
  });
});

describe("statusDoModulo", () => {
  it("rótulo em português e tom do ModuleStatus", () => {
    expect(statusDoModulo("ACTIVE")).toEqual({ rotulo: "Ativo", tom: "green" });
    expect(statusDoModulo("TRIAL")).toEqual({ rotulo: "Trial", tom: "blue" });
    expect(statusDoModulo("SUSPENDED")).toEqual({
      rotulo: "Suspenso",
      tom: "amber",
    });
    expect(statusDoModulo("CANCELED")).toEqual({
      rotulo: "Cancelado",
      tom: "red",
    });
  });

  it("status desconhecido aparece como veio", () => {
    expect(statusDoModulo("PAUSED")).toEqual({
      rotulo: "PAUSED",
      tom: "neutral",
    });
  });
});

describe("rotuloDoModulo", () => {
  it("é o de lib/rotulo-do-modulo, reexportado", () => {
    expect(rotuloDoModulo("COSMOS")).toBe("Cosmos");
    expect(ROTULO_DO_MODULO.SCAFFOLD).toBe("Scaffold");
  });
});
