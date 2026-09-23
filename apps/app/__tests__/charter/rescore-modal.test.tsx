/** @vitest-environment jsdom */
// rescore-modal.test.tsx — a tela de reavaliação de risco (PRD FR-5, FR-7).
// Três compromissos do DESIGN.md do Charter viram asserção: nenhum default
// afirma o que ninguém declarou (caso sem pontuação abre sem eixo marcado),
// a consequência aparece enquanto se preenche, com a regra à vista, e o
// motivo do bloqueio fica escrito no rodapé, não só no hover.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RescoreModal } from "../../components/charter/modals/rescore";

const CATEGORIAS = [
  "Privacidade",
  "Regulatório",
  "Segurança",
  "Viés",
  "PI / Confidencialidade",
  "Operacional",
  "Reputacional",
];

const flat = (n: number) => ({
  privacy: n,
  regulatory: n,
  security: n,
  bias: n,
  ip: n,
  operational: n,
  reputational: n,
});

function abrir(over: Partial<Parameters<typeof RescoreModal>[0]> = {}): {
  onSubmit: ReturnType<typeof vi.fn>;
} {
  const onSubmit = vi.fn();
  render(
    <RescoreModal
      actorName="Diego"
      actorRole="Segurança"
      caseCode="UC-003"
      caseTitle="Triagem de sinistros"
      current={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      pending={false}
      {...over}
    />
  );
  return { onSubmit };
}

function marcar(categoria: string, valor: number) {
  fireEvent.click(
    within(screen.getByRole("group", { name: categoria })).getByRole("button", {
      name: String(valor),
    })
  );
}

const registrar = () =>
  screen.getByRole("button", {
    name: /Registrar (pontuação|reavaliação)/,
  }) as HTMLButtonElement;

describe("RescoreModal", () => {
  it("caso sem pontuação abre sem eixo marcado e sem número composto", () => {
    abrir();

    expect(screen.getByText("Pontuar risco · UC-003")).toBeTruthy();
    for (const categoria of CATEGORIAS) {
      const botoes = within(
        screen.getByRole("group", { name: categoria })
      ).getAllByRole("button");
      expect(botoes).toHaveLength(5);
      expect(botoes.map((b) => b.getAttribute("aria-pressed"))).toEqual(
        new Array(5).fill("false")
      );
    }
    expect(screen.getByRole("status").textContent).toContain("—");
    expect(screen.getByText(/faltam 7/)).toBeTruthy();
    expect(registrar().disabled).toBe(true);
  });

  it("marcar os eixos recalcula o composto ao vivo", () => {
    abrir();

    marcar("Privacidade", 5);
    for (const categoria of CATEGORIAS.slice(1)) {
      marcar(categoria, 3);
    }

    // Severidade é o maior eixo (5); probabilidade, a média arredondada
    // (23/7 = 3,29 → 3); composto 15, Elevado.
    const resultado = screen.getByRole("status").textContent ?? "";
    expect(resultado).toContain("15");
    expect(resultado).toContain("Elevado");
    expect(resultado).toContain("sev 5 × prob 3");
  });

  it("sem justificativa não registra; com ela, envia os eixos e a nota", () => {
    const { onSubmit } = abrir();
    for (const categoria of CATEGORIAS) {
      marcar(categoria, 2);
    }

    expect(screen.getByText(/Escreva a justificativa/)).toBeTruthy();
    expect(registrar().disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Fornecedor passou a reter prompts por 30 dias." },
    });
    expect(registrar().disabled).toBe(false);
    fireEvent.click(registrar());

    expect(onSubmit).toHaveBeenCalledWith({
      risks: flat(2),
      note: "Fornecedor passou a reter prompts por 30 dias.",
    });
  });

  it("caso já pontuado abre com os valores atuais e mostra o antes → depois", () => {
    abrir({ current: { ...flat(1), privacy: 3 } });

    expect(screen.getByText("Reavaliar risco · UC-003")).toBeTruthy();
    const privacidade = within(
      screen.getByRole("group", { name: "Privacidade" })
    );
    expect(
      privacidade
        .getByRole("button", { name: "3" })
        .getAttribute("aria-pressed")
    ).toBe("true");

    marcar("Privacidade", 4);

    expect(screen.getByText("3 → 4")).toBeTruthy();
    // Antes: severidade 3 × probabilidade 1 = 3, Baixo. Depois: 4, Moderado.
    expect(screen.getByText("3 · Baixo")).toBeTruthy();
    const resultado = screen.getByRole("status").textContent ?? "";
    expect(resultado).toContain("Moderado");
  });

  it("no rodapé, quem registra a reavaliação quando nada mais falta", () => {
    abrir({ current: flat(2) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Revisão trimestral sem mudança de perfil." },
    });

    expect(screen.getByText(/Diego · Segurança/)).toBeTruthy();
  });
});
