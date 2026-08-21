// @vitest-environment jsdom
//
// use-form-action.test.tsx — pendência, ramificação do Result e limpeza de erro.
//
// O que este teste protege é o motivo do hook existir: `pendente` verdadeiro
// ENQUANTO a action corre. Sem isso o segundo clique manda a segunda chamada, e
// em `criar` isso é registro duplicado. É uma janela de tempo, e janela de
// tempo não aparece em revisão de código.

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFormAction } from "@/components/use-form-action";

/** Uma promessa que só resolve quando o teste mandar — é o que permite olhar o
 *  estado no meio do caminho, em vez de só depois. */
function promessaControlada<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

describe("useFormAction", () => {
  it("fica pendente enquanto a action corre e volta ao normal no fim", async () => {
    const { promessa, resolver } = promessaControlada<{
      ok: true;
      data: { id: string };
    }>();
    const { result } = renderHook(() => useFormAction());

    expect(result.current.pendente).toBe(false);

    act(() => {
      result.current.executar(() => promessa);
    });

    // O meio do caminho: é aqui que o segundo clique aconteceria.
    await waitFor(() => expect(result.current.pendente).toBe(true));

    await act(async () => {
      resolver({ ok: true, data: { id: "svc-1" } });
    });

    await waitFor(() => expect(result.current.pendente).toBe(false));
  });

  it("chama aoDarCerto com o dado quando ok é true", async () => {
    const aoDarCerto = vi.fn();
    const { result } = renderHook(() => useFormAction());

    await act(async () => {
      result.current.executar(
        () => Promise.resolve({ ok: true as const, data: { id: "svc-1" } }),
        aoDarCerto
      );
    });

    await waitFor(() =>
      expect(aoDarCerto).toHaveBeenCalledWith({ id: "svc-1" })
    );
    expect(result.current.erro).toBeNull();
  });

  it("mostra a mensagem da action e NÃO chama aoDarCerto quando ok é false", async () => {
    const aoDarCerto = vi.fn();
    const { result } = renderHook(() => useFormAction());

    await act(async () => {
      result.current.executar(
        () =>
          Promise.resolve({
            ok: false as const,
            error: "Seu papel no back-office permite apenas leitura.",
          }),
        aoDarCerto
      );
    });

    await waitFor(() =>
      expect(result.current.erro).toBe(
        "Seu papel no back-office permite apenas leitura."
      )
    );
    // O ramo de sucesso não roda no erro — sem isto a lista da tela ganharia
    // uma linha que o servidor recusou.
    expect(aoDarCerto).not.toHaveBeenCalled();
  });

  it("limpa o erro anterior ao começar a próxima tentativa", async () => {
    const { result } = renderHook(() => useFormAction());

    await act(async () => {
      result.current.executar(() =>
        Promise.resolve({ ok: false as const, error: "primeiro erro" })
      );
    });
    await waitFor(() => expect(result.current.erro).toBe("primeiro erro"));

    await act(async () => {
      result.current.executar(() =>
        Promise.resolve({ ok: true as const, data: null })
      );
    });

    // Erro velho ao lado de tentativa nova que deu certo é a tela mentindo.
    await waitFor(() => expect(result.current.erro).toBeNull());
  });

  it("action que lança vira mensagem, não promessa rejeitada sem dono", async () => {
    const { result } = renderHook(() => useFormAction());

    await act(async () => {
      result.current.executar(() => Promise.reject(new Error("rede caiu")));
    });

    await waitFor(() =>
      expect(result.current.erro).toBe("Não foi possível concluir a operação.")
    );
    expect(result.current.pendente).toBe(false);
  });
});
