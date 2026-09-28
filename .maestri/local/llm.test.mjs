// node --test .maestri/local/llm.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { perguntar } from "./llm.mjs";

const resposta = (texto, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => ({ choices: [{ message: { content: ` ${texto} ` } }] }),
  text: async () => texto,
});

test("perguntar: junta instrução e entrada, manda a chave e devolve o texto", async () => {
  let pedido;
  const r = await perguntar("Resuma:", "texto longo", {
    base: "http://gpu:8080/v1",
    chave: "k",
    fetchImpl: async (url, init) => {
      pedido = { url, init };
      return resposta("resumo");
    },
  });
  assert.equal(r, "resumo");
  assert.equal(pedido.url, "http://gpu:8080/v1/chat/completions");
  assert.equal(pedido.init.headers.authorization, "Bearer k");
  assert.equal(
    JSON.parse(pedido.init.body).messages[0].content,
    "Resuma:\n\ntexto longo"
  );
});

test("perguntar: desktop fora do ar ou sem endereço é 'fora' (quem chama não manda o dado para outro lugar)", async () => {
  await assert.rejects(
    perguntar("x", "", {
      base: "http://gpu:8080/v1",
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    }),
    (e) => e.fora === true
  );
  await assert.rejects(
    perguntar("x", "", { base: "" }),
    (e) => e.fora === true
  );
});

test("perguntar: erro HTTP não é 'fora'", async () => {
  await assert.rejects(
    perguntar("x", "", {
      base: "http://gpu:8080/v1",
      fetchImpl: async () => resposta("chave inválida", false, 401),
    }),
    (e) => !e.fora && /HTTP 401/.test(e.message)
  );
});
