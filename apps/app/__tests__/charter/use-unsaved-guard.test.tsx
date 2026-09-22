/** @vitest-environment jsdom */
// use-unsaved-guard.test.tsx — o guarda de trabalho não salvo fora de modal.
//
// `DirtyCtx` + `ModalHost.tryClose` já protegem o que se digita DENTRO de um
// modal. As três telas onde se escreve o texto que vira registro de auditoria
// (policy, settings, vendor-detail) editam em página, e lá não havia nada:
// clicar noutra seção, noutra aba ou no BackLink descartava calado.
//
// Este teste fixa o contrato do hook escopado ao Charter: enquanto sujo há
// `beforeunload` (F5 / fechar aba) e toda ação de saída passa por uma
// confirmação antes de rodar.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalProvider } from "../../components/charter/modal";
import { useUnsavedGuard } from "../../components/charter/use-unsaved-guard";

const O_QUE_SE_PERDE = "O texto editado da seção 03 · Uso aceitável";

function Harness({ dirty, onAct }: { dirty: boolean; onAct: () => void }) {
  const guard = useUnsavedGuard({ dirty, what: O_QUE_SE_PERDE });
  return (
    <button onClick={() => guard(onAct)} type="button">
      Trocar de seção
    </button>
  );
}

function renderHarness(dirty: boolean) {
  const onAct = vi.fn();
  const utils = render(
    <ModalProvider>
      <Harness dirty={dirty} onAct={onAct} />
    </ModalProvider>
  );
  return { ...utils, onAct };
}

type ListenerSpy = { mock: { calls: unknown[][] } };

/** Quantos listeners de `beforeunload` estão registrados na janela agora. */
function beforeunloadRegistrados(
  add: ListenerSpy,
  remove: ListenerSpy
): number {
  const conta = (spy: ListenerSpy) =>
    spy.mock.calls.filter((c) => c[0] === "beforeunload").length;
  return conta(add) - conta(remove);
}

describe("useUnsavedGuard — beforeunload", () => {
  let addSpy: ListenerSpy;
  let removeSpy: ListenerSpy;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  it("sujo registra beforeunload", () => {
    renderHarness(true);
    expect(beforeunloadRegistrados(addSpy, removeSpy)).toBe(1);
  });

  it("limpo não registra beforeunload", () => {
    renderHarness(false);
    expect(beforeunloadRegistrados(addSpy, removeSpy)).toBe(0);
  });

  it("desmontar limpo o registro", () => {
    const { unmount } = renderHarness(true);
    expect(beforeunloadRegistrados(addSpy, removeSpy)).toBe(1);
    unmount();
    expect(beforeunloadRegistrados(addSpy, removeSpy)).toBe(0);
  });
});

describe("useUnsavedGuard — guard", () => {
  it("limpo executa a ação direto, sem abrir confirmação", () => {
    const { onAct } = renderHarness(false);

    fireEvent.click(screen.getByText("Trocar de seção"));

    expect(onAct).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });

  it("sujo NÃO executa a ação e abre a confirmação nomeando o que se perde", async () => {
    const { onAct } = renderHarness(true);

    fireEvent.click(screen.getByText("Trocar de seção"));

    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    expect(screen.getByText(new RegExp(O_QUE_SE_PERDE))).toBeTruthy();
    expect(onAct).not.toHaveBeenCalled();
  });

  it("confirmar em Descartar executa a ação e fecha a confirmação", async () => {
    const { onAct } = renderHarness(true);

    fireEvent.click(screen.getByText("Trocar de seção"));
    await screen.findByText("Descartar alterações?");
    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onAct).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });

  it("cancelar não executa a ação e mantém o estado sujo guardado", async () => {
    const { onAct } = renderHarness(true);

    fireEvent.click(screen.getByText("Trocar de seção"));
    await screen.findByText("Descartar alterações?");
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() =>
      expect(screen.queryByText("Descartar alterações?")).toBeNull()
    );
    expect(onAct).not.toHaveBeenCalled();

    // Continua sujo: a próxima tentativa de sair pergunta de novo.
    fireEvent.click(screen.getByText("Trocar de seção"));
    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    expect(onAct).not.toHaveBeenCalled();
  });
});
