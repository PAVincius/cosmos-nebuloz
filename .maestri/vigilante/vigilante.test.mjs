// node --test .maestri/vigilante/vigilante.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { analisar, publicar, rodada } from "./vigilante.mjs";

const resposta = (texto) =>
  Response.json({ choices: [{ message: { content: texto } }] });

test("analisar manda o resumo ao LiteLLM com o modelo local e devolve o texto", async () => {
  let enviado;
  const fetchImpl = async (url, init) => {
    enviado = { url, corpo: JSON.parse(init.body) };
    return resposta("1. Sugestão X — evidência: linha Y");
  };
  const r = await analisar("## Vereditos\n...", {
    fetchImpl,
    url: "http://llm/v1/chat/completions",
    modelo: "local",
  });
  assert.equal(r, "1. Sugestão X — evidência: linha Y");
  assert.equal(enviado.url, "http://llm/v1/chat/completions");
  assert.equal(enviado.corpo.model, "local");
  assert.match(enviado.corpo.messages[0].content, /Não invente/);
  assert.equal(enviado.corpo.messages[1].content, "## Vereditos\n...");
});

test("analisar espera o modelo subir: tenta de novo enquanto a conexão é recusada", async () => {
  let n = 0;
  const fetchImpl = async () => {
    n += 1;
    if (n < 3) {
      throw new TypeError("fetch failed");
    }
    return resposta("ok");
  };
  assert.equal(await analisar("x", { fetchImpl, espera: 0 }), "ok");
  assert.equal(n, 3);
});

test("publicar acrescenta ao arquivo com data e hash, sem apagar o que havia", () => {
  const f = join(mkdtempSync(join(tmpdir(), "vig-")), "sugestoes.md");
  publicar("primeira", {
    arquivo: f,
    hash: "aaa",
    agora: new Date("2026-09-26T10:00:00Z"),
    nota: () => {},
  });
  publicar("segunda", {
    arquivo: f,
    hash: "bbb",
    agora: new Date("2026-09-26T11:00:00Z"),
    nota: () => {},
  });
  const txt = readFileSync(f, "utf8");
  assert.match(txt, /## 2026-09-26T10:00:00.000Z · resumo aaa\n\nprimeira/);
  assert.match(txt, /## 2026-09-26T11:00:00.000Z · resumo bbb\n\nsegunda/);
});

test("rodada: sem novidade não chama o modelo; com novidade, analisa e publica", async () => {
  const chamadas = [];
  const deps = {
    coletar: () => ({ texto: "resumo", hash: "h1" }),
    analisar: async (t) => {
      chamadas.push(t);
      return "sugestões";
    },
    publicar: (s, o) => chamadas.push(`publicou ${s} ${o.hash}`),
  };
  assert.equal(await rodada({ ultimoHash: "h1" }, deps), "h1");
  assert.deepEqual(chamadas, []);
  assert.equal(await rodada({ ultimoHash: "h0" }, deps), "h1");
  assert.deepEqual(chamadas, ["resumo", "publicou sugestões h1"]);
});
