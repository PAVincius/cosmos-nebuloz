import { describe, expect, it } from "vitest";
import { lerProcesso } from "../esquema";
import { processoMinimo } from "./fixture";

function problemasDe(entrada: unknown): string[] {
  const r = lerProcesso(entrada);
  return r.ok ? [] : r.problemas;
}

describe("lerProcesso — esquema fechado do processo", () => {
  it("aceita o processo mínimo", () => {
    const r = lerProcesso(processoMinimo());
    expect(r.ok).toBe(true);
  });

  it("recusa campo fora do esquema", () => {
    const p = { ...processoMinimo(), xml: "<bpmn/>" };
    expect(problemasDe(p).join(" ")).toMatch(/xml/);
  });

  it("recusa tipo de nó fora da lista", () => {
    const p = processoMinimo();
    p.nos[1] = { ...p.nos[1], tipo: "subProcesso" as never };
    expect(problemasDe(p).length).toBeGreaterThan(0);
  });

  it("recusa id repetido entre nós e raias", () => {
    const p = processoMinimo();
    p.nos[1] = { ...p.nos[1], id: "Raia_comercial" };
    expect(problemasDe(p).join(" ")).toMatch(/Raia_comercial.*repetido/);
  });

  it("recusa fluxo para nó que não existe", () => {
    const p = processoMinimo();
    p.fluxos.push({ de: "Analisar", para: "Fantasma" });
    expect(problemasDe(p).join(" ")).toMatch(/Fantasma/);
  });

  it("recusa nó em raia que não existe", () => {
    const p = processoMinimo();
    p.nos[1] = { ...p.nos[1], raia: "Raia_x" };
    expect(problemasDe(p).join(" ")).toMatch(/Raia_x/);
  });

  it("recusa raia sem nenhum nó", () => {
    const p = processoMinimo();
    p.raias.push({ id: "Raia_vazia", nome: "Vazia" });
    expect(problemasDe(p).join(" ")).toMatch(/Raia_vazia.*sem nenhum/);
  });

  it("recusa fluxo repetido", () => {
    const p = processoMinimo();
    p.fluxos.push({ de: "Inicio", para: "Analisar" });
    expect(problemasDe(p).join(" ")).toMatch(/repetido/);
  });

  it("exige ao menos uma fonte e um id XML válido", () => {
    expect(problemasDe({ ...processoMinimo(), fonte: [] }).length).toBe(1);
    const p = processoMinimo();
    p.nos[1] = { ...p.nos[1], id: "1 inválido" };
    expect(problemasDe(p).length).toBeGreaterThan(0);
  });
});
