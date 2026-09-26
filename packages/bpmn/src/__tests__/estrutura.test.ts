import { describe, expect, it } from "vitest";
import { checarEstrutura, type Grafo } from "../estrutura";

function grafo(parcial: Partial<Grafo> = {}): Grafo {
  return {
    nos: [
      { id: "I", tipo: "inicio", nome: "Início" },
      { id: "T", tipo: "outro", nome: "Tarefa" },
      { id: "F", tipo: "fim", nome: "Fim" },
    ],
    fluxos: [
      { de: "I", para: "T" },
      { de: "T", para: "F" },
    ],
    ...parcial,
  };
}

describe("checarEstrutura", () => {
  it("fluxo linear é válido", () => {
    expect(checarEstrutura(grafo())).toEqual([]);
  });

  it("exige início e fim", () => {
    const sem = checarEstrutura({
      nos: [{ id: "T", tipo: "outro", nome: "Tarefa" }],
      fluxos: [],
    });
    expect(sem.join(" ")).toMatch(/início/);
    expect(sem.join(" ")).toMatch(/fim/);
  });

  it("aponta nó inalcançável a partir do início", () => {
    const g = grafo();
    g.nos.push({ id: "Solto", tipo: "outro", nome: "Solto" });
    g.fluxos.push({ de: "Solto", para: "F" });
    expect(checarEstrutura(g).join(" ")).toMatch(/Solto.*não é alcançável/);
  });

  it("aponta caminho que não chega a um fim", () => {
    const g = grafo();
    g.nos.push({ id: "Beco", tipo: "outro", nome: "Beco" });
    g.fluxos.push({ de: "T", para: "Beco" });
    expect(checarEstrutura(g).join(" ")).toMatch(/Beco.*não chega a um fim/);
  });

  it("gateway que decide precisa de saídas rotuladas", () => {
    const g: Grafo = {
      nos: [
        { id: "I", tipo: "inicio", nome: "Início" },
        { id: "G", tipo: "gateway", nome: "Decide?" },
        { id: "A", tipo: "fim", nome: "A" },
        { id: "B", tipo: "fim", nome: "B" },
      ],
      fluxos: [
        { de: "I", para: "G" },
        { de: "G", para: "A", rotulo: "sim" },
        { de: "G", para: "B" },
      ],
    };
    expect(checarEstrutura(g).join(" ")).toMatch(/Decide\?.*sem rótulo/);
  });

  it("gateway com uma saída só vale como junção de dois ou mais caminhos", () => {
    const g = grafo({
      nos: [
        { id: "I", tipo: "inicio", nome: "Início" },
        { id: "G", tipo: "gateway", nome: "Passagem" },
        { id: "F", tipo: "fim", nome: "Fim" },
      ],
      fluxos: [
        { de: "I", para: "G" },
        { de: "G", para: "F" },
      ],
    });
    expect(checarEstrutura(g).join(" ")).toMatch(/Passagem.*duas saídas/);
  });

  it("início não recebe fluxo e fim não emite", () => {
    const g = grafo();
    g.fluxos.push({ de: "T", para: "I" });
    g.fluxos.push({ de: "F", para: "T" });
    const p = checarEstrutura(g).join(" ");
    expect(p).toMatch(/Início.*recebe/);
    expect(p).toMatch(/Fim.*sai/);
  });

  it("evento de borda conta como alcançável pela tarefa que o hospeda", () => {
    const g = grafo();
    g.nos.push({ id: "Borda", tipo: "outro", nome: "Prazo", hospedeiro: "T" });
    g.fluxos.push({ de: "Borda", para: "F" });
    expect(checarEstrutura(g)).toEqual([]);
  });
});
