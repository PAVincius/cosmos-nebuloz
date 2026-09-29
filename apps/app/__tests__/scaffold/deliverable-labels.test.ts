import { describe, expect, it } from "vitest";
import {
  KIND_LABEL,
  KINDS,
  PRODUCER_LABEL,
  PRODUCERS,
} from "@/lib/scaffold/deliverable-labels";
import { AddDeliverableSchema } from "@/lib/scaffold/schemas";

// Tipo e produtor do entregável por extenso. O que a tela oferece tem de ser
// exatamente o que a action aceita: opção a mais é recusa do servidor, e opção a
// menos esconde o que o Norte definiu.

describe("vocabulário do entregável", () => {
  it("os tipos da tela são os do schema da action", () => {
    expect([...AddDeliverableSchema.shape.kind.options].sort()).toEqual(
      [...KINDS].sort()
    );
  });

  it("os produtores da tela são os do schema da action", () => {
    expect([...AddDeliverableSchema.shape.producer.options].sort()).toEqual(
      [...PRODUCERS].sort()
    );
  });

  it("todo rótulo é pt-BR legível, nunca o código cru", () => {
    for (const label of [
      ...Object.values(KIND_LABEL),
      ...Object.values(PRODUCER_LABEL),
    ]) {
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });
});
