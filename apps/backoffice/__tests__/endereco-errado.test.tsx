/** @vitest-environment jsdom */
// endereco-errado.test.tsx — onda 8a, bloco 2: o endereço errado fica no
// painel. Não havia `app/not-found.tsx` nem `app/global-error.tsx`: `/cliente/x`
// (fora do grupo `(staff)`) caía no 404 do Next, em inglês e sem os tokens do
// painel; uma falha no layout raiz (sign-in, segurança) caía na tela genérica.
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "@/app/global-error";
import NaoEncontradoRaiz from "@/app/not-found";
import { FalhaGeral } from "@/components/falha-geral";

describe("app/not-found.tsx — o 404 da raiz fala a língua do painel", () => {
  it("diz em pt-BR que o endereço não existe e leva à Home (/)", () => {
    render(<NaoEncontradoRaiz />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Página não encontrada" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ir para a Home" }).getAttribute("href")
    ).toBe("/");
    expect(screen.queryByText(/could not be found/i)).toBeNull();
  });
});

describe("app/global-error.tsx — a falha do layout raiz não cai no genérico", () => {
  it("traz o próprio <html lang='pt-BR'> e <body>", () => {
    const html = renderToStaticMarkup(
      <GlobalError error={new Error("boom")} reset={vi.fn()} />
    );
    expect(html.startsWith('<html lang="pt-BR"')).toBe(true);
    expect(html).toContain("<body");
  });

  it("nomeia a falha, mostra o digest em mono e Tentar de novo chama reset", () => {
    const reset = vi.fn();
    const erro = Object.assign(new Error("boom"), { digest: "3141592653" });
    render(<FalhaGeral error={erro} reset={reset} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "O painel não carregou" })
    ).toBeTruthy();
    expect(screen.getByText("3141592653").className).toContain("mono");

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("sem digest, não inventa código para o suporte", () => {
    render(<FalhaGeral error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.queryByText(/Código para o suporte/)).toBeNull();
  });
});
