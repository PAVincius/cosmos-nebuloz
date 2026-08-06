// prompt-hierarchy.test.ts — hierarquia de instruções do copiloto.
//
// As regras do produto precisam chegar ao modelo como `system`. Enviadas como
// `role: "user"`, elas têm exatamente a mesma autoridade que o texto de quem
// está do outro lado — não existe hierarquia a respeitar porque nenhuma foi
// declarada. O próprio AI SDK documenta a mensagem de sistema única como
// "resilience against prompt injection attacks".
//
// O cache efêmero da Anthropic é o motivo provável de o bloco ter nascido como
// `user` (parts aceitam `cacheControl`). Ele funciona em `system` também, via
// `providerOptions` na mensagem — por isso o teste exige as duas coisas ao
// mesmo tempo: autoridade e cache.
import { describe, expect, it } from "vitest";
import { getModeMessages } from "../../../app/actions/safe-copilot/prompts";

const CONTEXTO = {
  mode: "global",
  surface: "global",
} as Parameters<typeof getModeMessages>[1];

function montar(userMessages: { role: string; content: string }[]) {
  return getModeMessages(
    "global",
    CONTEXTO,
    userMessages as Parameters<typeof getModeMessages>[2],
    "PAPEL DE TESTE"
  );
}

describe("getModeMessages", () => {
  it("as regras do produto vão como system", () => {
    const msgs = montar([{ role: "user", content: "oi" }]);

    expect(msgs[0].role).toBe("system");
  });

  it("há uma única mensagem de system", () => {
    // Vários blocos de sistema não são suportados por todo provider, e cada um
    // a mais é uma superfície onde a hierarquia se dilui.
    const msgs = montar([{ role: "user", content: "oi" }]);

    expect(msgs.filter((m) => m.role === "system")).toHaveLength(1);
  });

  it("o system vem primeiro, antes de qualquer texto do usuário", () => {
    const msgs = montar([{ role: "user", content: "oi" }]);
    const primeiroUsuario = msgs.findIndex((m) => m.role === "user");

    expect(msgs.findIndex((m) => m.role === "system")).toBeLessThan(
      primeiroUsuario
    );
  });

  it("mantém o cache efêmero — a economia não foi trocada pela segurança", () => {
    const msgs = montar([{ role: "user", content: "oi" }]);
    const sistema = msgs.find((m) => m.role === "system");

    expect(
      (sistema as { providerOptions?: Record<string, unknown> }).providerOptions
        ?.anthropic
    ).toEqual({ cacheControl: { type: "ephemeral" } });
  });

  it("preserva as mensagens do usuário, na ordem", () => {
    const msgs = montar([
      { role: "user", content: "primeira" },
      { role: "assistant", content: "resposta" },
      { role: "user", content: "segunda" },
    ]);

    const conteudos = msgs.map((m) =>
      typeof m.content === "string" ? m.content : ""
    );
    expect(conteudos).toContain("primeira");
    expect(conteudos).toContain("segunda");
    expect(conteudos.indexOf("primeira")).toBeLessThan(
      conteudos.indexOf("segunda")
    );
  });
});
