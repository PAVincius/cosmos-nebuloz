/** @vitest-environment jsdom */
// processos-painel-link.test.tsx — "Abrir no modelador" leva ao diagrama do
// processo, não ao Estúdio genérico: com diagrama vinculado o link carrega
// `?diagrama=<id>`; sem vínculo vira "Criar diagrama para {nome}" com
// `?novo=<nome>`, que o Estúdio lê para pré-preencher o formulário.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Painel } from "@/app/(staff)/ferramentas/processos/painel";
import type { ProcessoRow } from "@/app/actions/processos";

function processo(over: Partial<ProcessoRow>): ProcessoRow {
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

function montar(p: ProcessoRow) {
  return render(
    <Painel
      executando={false}
      ligacoes={[]}
      onCriarLigacao={vi.fn()}
      onEditar={vi.fn()}
      onExcluirLigacao={vi.fn()}
      onExcluirProcesso={vi.fn()}
      onSelecionar={vi.fn()}
      podeEscrever={false}
      processo={p}
      processos={[p]}
    />
  );
}

describe("Painel — link para o modelador", () => {
  it("processo com diagrama: Abrir no modelador aponta para ?diagrama=<id>", () => {
    montar(
      processo({
        diagram: { id: "d7", name: "Funil BPMN", slug: "funil", versoes: 3 },
        diagramId: "d7",
        nome: "Funil de leads",
      })
    );

    const link = screen.getByRole("link", { name: /Abrir no modelador/ });
    expect(link.getAttribute("href")).toBe("/ferramentas/bpmn?diagrama=d7");
  });

  it("processo sem diagrama: Criar diagrama para {nome} aponta para ?novo=<nome>", () => {
    montar(processo({ nome: "Gate de fase" }));

    const link = screen.getByRole("link", {
      name: "Criar diagrama para Gate de fase",
    });
    expect(link.getAttribute("href")).toBe(
      "/ferramentas/bpmn?novo=Gate%20de%20fase"
    );
  });
});
