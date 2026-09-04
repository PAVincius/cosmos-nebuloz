import { describe, expect, it } from "vitest";
import { extrairSecao, preservarSecoes } from "../preservar-secoes.mts";

const gerada = [
  "# meridian",
  "",
  "Resumo regenerado pela rotina.",
  "",
  "## Estado de tarefa",
  "",
  "## Obstáculos",
  "",
].join("\n");

describe("extrairSecao", () => {
  it("devolve o corpo entre o título e o próximo ## ou o fim", () => {
    const md = "# t\n\n## A\nlinha a1\nlinha a2\n\n## B\nlinha b\n";
    expect(extrairSecao(md, "## A")).toBe("linha a1\nlinha a2");
    expect(extrairSecao(md, "## B")).toBe("linha b");
  });

  it("seção ausente → null; seção vazia → string vazia", () => {
    expect(extrairSecao("# t\n## A\n", "## B")).toBeNull();
    expect(extrairSecao("# t\n## A\n\n## B\n", "## A")).toBe("");
  });
});

describe("preservarSecoes", () => {
  it("mantém byte a byte o que o especialista escreveu nas duas seções", () => {
    const atual = [
      "# meridian",
      "",
      "Resumo VELHO que a rotina vai substituir.",
      "",
      "## Estado de tarefa",
      "- [ ] G-02 em andamento",
      "  detalhe com   espaços   e `código`",
      "",
      "## Obstáculos",
      "Plano do Fireflies não expõe participants — confirmar.",
      "",
    ].join("\n");

    const { note, avisos } = preservarSecoes(atual, gerada);
    expect(avisos).toEqual([]);
    expect(note).toContain("Resumo regenerado pela rotina.");
    expect(note).not.toContain("Resumo VELHO");
    expect(extrairSecao(note, "## Estado de tarefa")).toBe(
      "- [ ] G-02 em andamento\n  detalhe com   espaços   e `código`"
    );
    expect(extrairSecao(note, "## Obstáculos")).toBe(
      "Plano do Fireflies não expõe participants — confirmar."
    );
  });

  it("note atual nula (primeira execução) → devolve a gerada, sem aviso", () => {
    const { note, avisos } = preservarSecoes(null, gerada);
    expect(note).toBe(gerada);
    expect(avisos).toEqual([]);
  });

  it("especialista apagou uma seção → recria vazia e avisa (spec §5)", () => {
    const semObstaculos = "# meridian\n\n## Estado de tarefa\nfoo\n";
    const { note, avisos } = preservarSecoes(semObstaculos, gerada);
    expect(extrairSecao(note, "## Estado de tarefa")).toBe("foo");
    expect(extrairSecao(note, "## Obstáculos")).toBe("");
    expect(avisos).toEqual([
      'seção "## Obstáculos" ausente na note atual — recriada vazia',
    ]);
  });

  it("é idempotente: aplicar duas vezes dá o mesmo resultado", () => {
    const atual = "# m\n\n## Estado de tarefa\nx\n\n## Obstáculos\ny\n";
    const uma = preservarSecoes(atual, gerada).note;
    const duas = preservarSecoes(uma, gerada).note;
    expect(duas).toBe(uma);
  });
});
