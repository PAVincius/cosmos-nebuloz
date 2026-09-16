/** @vitest-environment jsdom */
// consentimento-copiar.test.tsx — "Copiar" diz se copiou.
//
// O botão chamava `navigator.clipboard.writeText` e ficava mudo: sem
// "Copiado" ninguém sabe se o texto está na área de transferência, e quando o
// navegador recusa (aba sem foco, permissão negada) a pessoa cola vazio. Agora:
// "Copiado" por 2 s numa região `aria-live="polite"`; na falha, "Não deu para
// copiar — selecione o texto".
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Painel } from "@/app/(staff)/empresa/consentimento/painel";
import type { ConsentimentoView } from "@/app/actions/empresa/consentimento";

vi.mock("@/app/actions/empresa/consentimento", () => ({
  lerConsentimento: vi.fn(),
  marcarParecer: vi.fn(),
  responderPergunta: vi.fn(),
  salvarDecisao: vi.fn(),
}));

const VIEW: ConsentimentoView = {
  abertas: 0,
  avisos: [
    {
      abertos: [],
      nota: "",
      peca: "INTERNA_PT",
      texto: "Texto do aviso interno.",
      titulo: "Aviso interno",
    },
  ],
  camposEmAberto: [],
  decisao: {
    baseLegal: "SEM_DECISAO",
    contatoTitular: null,
    ferramenta: null,
    parecer: "PENDENTE",
    parecerEnviadoEm: null,
    parecerRecebidoEm: null,
    prazoRetencao: null,
    standingHabilitavel: null,
  },
  perguntas: [],
};

function montarClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("Consentimento — Copiar com feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a região de feedback é aria-live polite e existe antes do clique", () => {
    montarClipboard(() => Promise.resolve());
    render(<Painel inicial={VIEW} podeEscrever />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });

  it("copiou: 'Copiado' aparece e some depois de 2 s", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    montarClipboard(writeText);
    render(<Painel inicial={VIEW} podeEscrever />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    });

    expect(writeText).toHaveBeenCalledWith("Texto do aviso interno.");
    expect(screen.getByRole("status").textContent).toBe("Copiado");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("falhou: diz que não deu e pede para selecionar o texto", async () => {
    montarClipboard(() => Promise.reject(new Error("NotAllowedError")));
    render(<Painel inicial={VIEW} podeEscrever />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    });

    expect(screen.getByRole("status").textContent).toBe(
      "Não deu para copiar — selecione o texto"
    );
  });
});
