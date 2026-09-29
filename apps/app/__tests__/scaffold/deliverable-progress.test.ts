import { describe, expect, it } from "vitest";
import { deliverableProgress } from "@/lib/scaffold/deliverable-progress";

// "X/Y entregáveis" do portfólio (PDF p.3): aprovados sobre obrigatórios. Opcional
// e dispensado não entram na conta, e o A3.2 (caso de negócio) conta como
// aprovado quando o caso está assinado, como no gate.

const d = (code: string, status: string, required = true) => ({
  code,
  status,
  required,
});

describe("deliverableProgress", () => {
  it("aprovados sobre obrigatórios", () => {
    expect(
      deliverableProgress(
        [
          d("A1.1", "APPROVED"),
          d("A2.1", "IN_REVIEW"),
          d("A3.1", "NOT_STARTED"),
        ],
        false
      )
    ).toEqual({ approved: 1, required: 3 });
  });

  it("opcional e dispensado ficam fora", () => {
    expect(
      deliverableProgress(
        [
          d("A1.1", "APPROVED"),
          d("X-001", "APPROVED", false),
          d("C1.1", "NOT_STARTED", false),
        ],
        false
      )
    ).toEqual({ approved: 1, required: 1 });
  });

  it("A3.2 vale como aprovado com o caso assinado, e pendente sem ele", () => {
    const items = [d("A3.1", "APPROVED"), d("A3.2", "NOT_STARTED")];
    expect(deliverableProgress(items, true)).toEqual({
      approved: 2,
      required: 2,
    });
    expect(deliverableProgress(items, false)).toEqual({
      approved: 1,
      required: 2,
    });
  });

  it("reaberto não conta como aprovado", () => {
    expect(deliverableProgress([d("A1.1", "REOPENED")], false)).toEqual({
      approved: 0,
      required: 1,
    });
  });

  it("trilha sem entregável (anterior ao modelo): 0/0, e o chamador não mostra fração", () => {
    expect(deliverableProgress([], true)).toEqual({ approved: 0, required: 0 });
  });
});
