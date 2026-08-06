// mascara.test.ts — o que sai daqui para o Langfuse.
//
// O trace do copiloto mandava `input: modeMessages` e `output: text` para um
// terceiro. `modeMessages` carrega `summarizeContext(context)`: PI workspace,
// métricas de fluxo, lean budget e portfólio do tenant. Não é bug — é
// observabilidade, e ela é útil. Mas é dado de cliente saindo, e o padrão de um
// SaaS multi-tenant não deveria ser "sai tudo".
//
// A máscara não desliga a observabilidade: preserva **forma** e **identificador**
// e apaga **conteúdo**. Um trace continua respondendo "quantas mensagens, quais
// papéis, qual modelo, quantos tokens, quanto custou" — que é o que se olha em
// 99% das vezes — sem carregar o texto.

import { mascararConteudo } from "@repo/ai/lib/mascara";
import { describe, expect, it } from "vitest";

describe("mascararConteudo", () => {
  it("apaga texto livre", () => {
    const r = mascararConteudo({ content: "orçamento do cliente Vanta é 2M" });

    expect(r.content).not.toContain("Vanta");
  });

  it("diz o tamanho do que apagou — trace sem noção de volume não serve", () => {
    const r = mascararConteudo({ content: "12345" });

    expect(String(r.content)).toContain("5");
  });

  it("preserva o papel da mensagem", () => {
    const r = mascararConteudo([
      { role: "system", content: "regras" },
      { role: "user", content: "pergunta do cliente" },
    ]);

    expect(r[0].role).toBe("system");
    expect(r[1].role).toBe("user");
  });

  it("preserva a forma: array continua array, com o mesmo tamanho", () => {
    const r = mascararConteudo([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ]);

    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(3);
  });

  it("preserva números — token e custo são o que se olha", () => {
    const r = mascararConteudo({
      usage: { input: 1200, output: 340, total: 1540 },
    });

    expect(r.usage).toEqual({ input: 1200, output: 340, total: 1540 });
  });

  it("preserva booleanos", () => {
    const r = mascararConteudo({ hasPI: true, hasFlow: false });

    expect(r).toEqual({ hasPI: true, hasFlow: false });
  });

  it("preserva identificadores — sem eles não dá para correlacionar", () => {
    const r = mascararConteudo({
      tenantId: "t-1",
      userId: "u-9",
      sessionId: "s-3",
      model: "claude-haiku-4-5-20251001",
      provider: "anthropic",
      mode: "rte",
    });

    expect(r).toEqual({
      tenantId: "t-1",
      userId: "u-9",
      sessionId: "s-3",
      model: "claude-haiku-4-5-20251001",
      provider: "anthropic",
      mode: "rte",
    });
  });

  it("desce em estrutura aninhada", () => {
    const r = mascararConteudo({
      messages: [
        { role: "user", content: [{ type: "text", text: "segredo" }] },
      ],
    });

    expect(JSON.stringify(r)).not.toContain("segredo");
    // …mas o tipo da part sobrevive, senão não dá para saber o que trafegou.
    expect(JSON.stringify(r)).toContain("text");
  });

  it("aguenta null e undefined sem estourar", () => {
    expect(() => mascararConteudo(null)).not.toThrow();
    expect(() => mascararConteudo(undefined)).not.toThrow();
  });

  it("string solta na raiz também é apagada", () => {
    const r = mascararConteudo("resposta inteira do modelo");

    expect(r).not.toContain("resposta inteira");
  });

  it("não vaza conteúdo por chave desconhecida", () => {
    // O padrão é apagar. Uma chave nova que alguém acrescente amanhã não deve
    // passar a vazar só porque ninguém lembrou de listá-la.
    const r = mascararConteudo({ campoQueNinguemPreviu: "dado do cliente" });

    expect(JSON.stringify(r)).not.toContain("dado do cliente");
  });
});
