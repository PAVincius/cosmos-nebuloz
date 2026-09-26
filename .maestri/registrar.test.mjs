// node --test .maestri/registrar.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { registrar, resumo } from "./registrar.mjs";

const arquivo = () =>
  join(mkdtempSync(join(tmpdir(), "aprendizado-")), "aprendizado.jsonl");
const agora = new Date("2026-09-25T12:00:00Z");

test("registrar acrescenta uma linha JSON por evento, com data", () => {
  const f = arquivo();
  registrar(
    {
      agente: "Crivo",
      tarefa: "PR #250",
      veredito: "reprovado",
      causa: "sem filtro tenantId",
      produto: "cosmos",
    },
    f,
    agora
  );
  registrar(
    { agente: "Crivo", tarefa: "PR #251", veredito: "aprovado" },
    f,
    agora
  );
  const linhas = readFileSync(f, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas[0], {
    ts: "2026-09-25T12:00:00.000Z",
    agente: "Crivo",
    tarefa: "PR #250",
    veredito: "reprovado",
    causa: "sem filtro tenantId",
    produto: "cosmos",
  });
});

test("registrar recusa veredito fora da lista e reprovação sem causa", () => {
  const f = arquivo();
  assert.throws(
    () => registrar({ agente: "Crivo", tarefa: "x", veredito: "talvez" }, f),
    /veredito/
  );
  assert.throws(
    () => registrar({ agente: "Crivo", tarefa: "x", veredito: "reprovado" }, f),
    /causa/
  );
  assert.throws(
    () => registrar({ tarefa: "x", veredito: "aprovado" }, f),
    /agente/
  );
});

test("resumo: taxa por agente e causas que se repetem na janela", () => {
  const f = arquivo();
  const linha = (dias, e) =>
    JSON.stringify({ ts: new Date(agora - dias * 864e5).toISOString(), ...e });
  writeFileSync(
    f,
    `${[
      linha(1, {
        agente: "Orbita",
        tarefa: "a",
        veredito: "reprovado",
        causa: "Sem filtro tenantId ",
      }),
      linha(2, {
        agente: "Selo",
        tarefa: "b",
        veredito: "reprovado",
        causa: "sem filtro tenantId",
      }),
      linha(3, { agente: "Orbita", tarefa: "c", veredito: "aprovado" }),
      linha(4, {
        agente: "Orbita",
        tarefa: "d",
        veredito: "achado",
        causa: "log com e-mail",
      }),
      linha(30, {
        agente: "Selo",
        tarefa: "velho",
        veredito: "reprovado",
        causa: "fora da janela",
      }),
    ].join("\n")}\n`
  );
  const { code, out } = resumo(f, 7, agora);
  assert.equal(code, 0);
  assert.match(out, /4 eventos em 7 dias/);
  assert.match(out, /Orbita: 1 aprovado, 1 reprovado, 1 achado/);
  assert.match(out, /Selo: 0 aprovado, 1 reprovado, 0 achado/);
  assert.match(out, /2× sem filtro tenantId \(Orbita, Selo\)/i);
  assert.doesNotMatch(out, /fora da janela/);
});

test("resumo sem eventos na janela sai 1: a retro é pulada", () => {
  assert.deepEqual(resumo(arquivo(), 7, agora), { code: 1, out: "" });
});
