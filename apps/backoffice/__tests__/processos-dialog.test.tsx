/** @vitest-environment jsdom */
// processos-dialog.test.tsx — Task 6, spec §4. Prova o `ProcessoDialog`
// (criar/editar) e o mini-formulário "Nova ligação" do `Painel`. Mesmo padrão
// do `LeadDialog` em `__tests__/funil-dialogs.test.tsx`: o Radix Dialog só
// monta o formulário quando `aberto` é true, então cada teste que precisa do
// conteúdo passa `aberto`.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Painel } from "@/app/(staff)/ferramentas/processos/painel";
import { ProcessoDialog } from "@/app/(staff)/ferramentas/processos/processo-dialog";
import type { ProcessoRow } from "@/app/actions/processos";
import type { Result } from "@/lib/safe-action";

function processoFactory(over: Partial<ProcessoRow>): ProcessoRow {
  return {
    codigo: "PZ-01",
    descricao: "",
    diagram: null,
    diagramId: null,
    docUrl: null,
    dominio: "COMERCIAL",
    donoNome: null,
    id: "a",
    nivel: 2,
    nome: "Processo",
    revisadoEm: null,
    tags: [],
    tipo: "CORE",
    ...over,
  };
}

function ok(data: unknown = {}): Promise<Result<unknown>> {
  return Promise.resolve({ data, ok: true });
}

describe("ProcessoDialog", () => {
  it("aberto sem processo, o título é 'Novo processo' e Salvar começa desabilitado", () => {
    render(
      <ProcessoDialog
        aberto
        diagramas={[]}
        onFechar={vi.fn()}
        onSalvar={vi.fn(() => ok())}
        processo={null}
      />
    );

    expect(screen.getByRole("heading", { name: "Novo processo" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Salvar" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("preenchendo código, nome e descrição, Salvar libera e o clique chama onSalvar com tags como array", () => {
    const onSalvar = vi.fn(() => ok());

    render(
      <ProcessoDialog
        aberto
        diagramas={[]}
        onFechar={vi.fn()}
        onSalvar={onSalvar}
        processo={null}
      />
    );

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "PZ-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Processo novo" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Faz alguma coisa relevante." },
    });
    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "cac, estágio" },
    });

    const salvar = screen.getByRole("button", { name: "Salvar" });
    expect(salvar.hasAttribute("disabled")).toBe(false);

    fireEvent.click(salvar);

    expect(onSalvar).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: "PZ-09",
        descricao: "Faz alguma coisa relevante.",
        nome: "Processo novo",
        tags: ["cac", "estágio"],
      })
    );
  });

  it("código no formato errado ('PZ-1') mantém Salvar desabilitado", () => {
    render(
      <ProcessoDialog
        aberto
        diagramas={[]}
        onFechar={vi.fn()}
        onSalvar={vi.fn(() => ok())}
        processo={null}
      />
    );

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "PZ-1" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Processo novo" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Descrição válida." },
    });

    expect(
      screen.getByRole("button", { name: "Salvar" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("aberto com um processo, o título é 'Editar processo' e os campos vêm preenchidos", () => {
    const processo = processoFactory({
      codigo: "PZ-02",
      descricao: "Aprova a passagem de fase.",
      donoNome: "Ana",
      nome: "Gate de fase",
      revisadoEm: "2026-08-01T00:00:00.000Z",
      tags: ["cac", "gate"],
    });

    render(
      <ProcessoDialog
        aberto
        diagramas={[]}
        onFechar={vi.fn()}
        onSalvar={vi.fn(() => ok())}
        processo={processo}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Editar processo" })
    ).toBeTruthy();
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe(
      "PZ-02"
    );
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
      "Gate de fase"
    );
    expect(
      (screen.getByLabelText("Descrição") as HTMLTextAreaElement).value
    ).toBe("Aprova a passagem de fase.");
    expect((screen.getByLabelText("Dono") as HTMLInputElement).value).toBe(
      "Ana"
    );
    expect(
      (screen.getByLabelText("Revisado em") as HTMLInputElement).value
    ).toBe("2026-08-01");
    expect((screen.getByLabelText("Tags") as HTMLInputElement).value).toBe(
      "cac, gate"
    );
  });

  it("onSalvar devolvendo erro mostra a mensagem dentro do diálogo e não fecha", async () => {
    const onFechar = vi.fn();
    const onSalvar = vi.fn(() =>
      Promise.resolve({ error: "Já existe PZ-01.", ok: false as const })
    );

    render(
      <ProcessoDialog
        aberto
        diagramas={[]}
        onFechar={onFechar}
        onSalvar={onSalvar}
        processo={null}
      />
    );

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "PZ-01" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Processo novo" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Descrição válida." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Já existe PZ-01.")).toBeTruthy();
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Novo processo" })).toBeTruthy();
  });
});

describe("Painel — Nova ligação", () => {
  it("com destino e rótulo preenchidos, chama onCriarLigacao com o id do destino e o rótulo", () => {
    const processoA = processoFactory({ codigo: "PZ-01", id: "a" });
    const processoB = processoFactory({
      codigo: "PZ-02",
      id: "b",
      nome: "Gate de fase",
    });
    const onCriarLigacao = vi.fn(() => ok());

    render(
      <Painel
        executando={false}
        ligacoes={[]}
        onCriarLigacao={onCriarLigacao}
        onEditar={vi.fn()}
        onExcluirLigacao={vi.fn()}
        onExcluirProcesso={vi.fn()}
        onSelecionar={vi.fn()}
        podeEscrever={true}
        processo={processoA}
        processos={[processoA, processoB]}
      />
    );

    fireEvent.change(screen.getByLabelText("Destino da ligação"), {
      target: { value: "b" },
    });
    fireEvent.change(screen.getByLabelText("Rótulo da ligação"), {
      target: { value: "alimenta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(onCriarLigacao).toHaveBeenCalledWith("b", "alimenta");
  });

  it("sem permissão de escrita não mostra o formulário de nova ligação", () => {
    const processoA = processoFactory({ codigo: "PZ-01", id: "a" });
    const processoB = processoFactory({
      codigo: "PZ-02",
      id: "b",
      nome: "Gate de fase",
    });

    render(
      <Painel
        executando={false}
        ligacoes={[]}
        onCriarLigacao={vi.fn(() => ok())}
        onEditar={vi.fn()}
        onExcluirLigacao={vi.fn()}
        onExcluirProcesso={vi.fn()}
        onSelecionar={vi.fn()}
        podeEscrever={false}
        processo={processoA}
        processos={[processoA, processoB]}
      />
    );

    expect(screen.queryByLabelText("Destino da ligação")).toBeNull();
  });
});
