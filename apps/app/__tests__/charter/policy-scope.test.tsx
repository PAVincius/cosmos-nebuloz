/** @vitest-environment jsdom */
// policy-scope.test.tsx — painel de alcance da política: fora antes de
// dentro (a lista existe para fechar lacuna, não para exibir quem já está
// coberto), vincular/desvincular chamando a action certa com o alvo certo e
// recarregando a leitura, tenant sem política sem quebrar a tela, e loading
// distinto de "sem política" — os dois são estados diferentes de `data`
// (ver useCharterData) e precisam renderizar coisas diferentes, senão um
// tenant sem política fica preso em "Carregando…". Asserção sobre conteúdo,
// sem snapshot.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPolicyScopeMock = vi.hoisted(() => vi.fn());
const linkPolicyMock = vi.hoisted(() => vi.fn());
const unlinkPolicyMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicyScope: (...a: unknown[]) => getPolicyScopeMock(...a),
  linkPolicy: (...a: unknown[]) => linkPolicyMock(...a),
  unlinkPolicy: (...a: unknown[]) => unlinkPolicyMock(...a),
}));

import PolicyScope from "../../components/charter/screens/policy-scope";

describe("PolicyScope", () => {
  beforeEach(() => {
    getPolicyScopeMock.mockReset();
    linkPolicyMock.mockReset();
    unlinkPolicyMock.mockReset();
    getPolicyScopeMock.mockResolvedValue({
      ok: true,
      data: {
        policyId: "pol-1",
        casos: [
          { id: "uc-1", rotulo: "UC-001 Triagem", vinculado: true },
          { id: "uc-2", rotulo: "UC-002 Sumarizador", vinculado: false },
        ],
        vendors: [{ id: "v-1", rotulo: "V-001 OpenAI", vinculado: false }],
      },
    });
  });

  it("mostra os que estão fora antes dos que estão dentro", async () => {
    const { container } = render(<PolicyScope />);

    expect(await screen.findByText(/2 fora da política/)).toBeTruthy();

    // Sequência dos rótulos renderizados, não data-testid: os dois "fora"
    // (UC-002, V-001) precisam vir antes do único "dentro" (UC-001).
    const texto = container.textContent ?? "";
    const idxUc2 = texto.indexOf("UC-002 Sumarizador");
    const idxV1 = texto.indexOf("V-001 OpenAI");
    const idxUc1 = texto.indexOf("UC-001 Triagem");
    expect(idxUc2).toBeGreaterThan(-1);
    expect(idxV1).toBeGreaterThan(-1);
    expect(idxUc1).toBeGreaterThan(-1);
    expect(idxUc2).toBeLessThan(idxUc1);
    expect(idxV1).toBeLessThan(idxUc1);
  });

  it("vincular chama linkPolicy com o alvo certo e recarrega", async () => {
    linkPolicyMock.mockResolvedValue({ ok: true, data: null });
    render(<PolicyScope />);
    await screen.findByText("UC-002 Sumarizador");

    // Todas as linhas fora da política dizem "Vincular" — escopar pela
    // linha (via o rótulo) é o que alcança o botão certo.
    const linha = screen.getByText("UC-002 Sumarizador").closest("div");
    fireEvent.click(within(linha as HTMLElement).getByRole("button"));

    await waitFor(() =>
      expect(linkPolicyMock).toHaveBeenCalledWith({
        policyId: "pol-1",
        alvoTipo: "USE_CASE",
        alvoId: "uc-2",
      })
    );
    await waitFor(() =>
      expect(getPolicyScopeMock.mock.calls.length).toBeGreaterThan(1)
    );
  });

  it("desvincular chama unlinkPolicy com o alvo certo", async () => {
    unlinkPolicyMock.mockResolvedValue({ ok: true, data: null });
    render(<PolicyScope />);
    await screen.findByText("UC-001 Triagem");

    const linha = screen.getByText("UC-001 Triagem").closest("div");
    fireEvent.click(within(linha as HTMLElement).getByRole("button"));

    await waitFor(() =>
      expect(unlinkPolicyMock).toHaveBeenCalledWith({
        policyId: "pol-1",
        alvoTipo: "USE_CASE",
        alvoId: "uc-1",
      })
    );
  });

  it("tenant sem política mostra o aviso, não quebra a tela", async () => {
    getPolicyScopeMock.mockResolvedValue({ ok: true, data: null });
    render(<PolicyScope />);

    expect(
      await screen.findByText(/Nenhuma política nesta organização/)
    ).toBeTruthy();
  });

  it("enquanto carrega, mostra o estado de carregamento — não a mensagem de tenant sem política", () => {
    // Promise que nunca resolve: reproduz a janela em que `loading` é true e
    // `data` ainda é null — o mesmo `null` que, depois de resolvida, passa a
    // significar "tenant sem política". Os dois precisam renderizar coisas
    // diferentes.
    getPolicyScopeMock.mockReturnValue(new Promise(() => {}));
    render(<PolicyScope />);

    expect(screen.getByText("Carregando…")).toBeTruthy();
    expect(screen.queryByText(/Nenhuma política nesta organização/)).toBeNull();
  });
});
