// node --test .maestri/registrar.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  conceder,
  concessoes,
  pedido,
  registrar,
  resumo,
  resumoPedidos,
} from "./registrar.mjs";

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

test("conceder registra quem, para quem, escopo e validade; no máximo 24 h", () => {
  const f = arquivo();
  const c = conceder(
    {
      de: "Norte",
      para: "Regua",
      escopo: "editar docs/produto/cosmos-prd.md",
      motivo: "ajuste de critério de aceite",
      horas: "4",
    },
    f,
    agora
  );
  assert.equal(c.ate, "2026-09-25T16:00:00.000Z");
  assert.deepEqual(JSON.parse(readFileSync(f, "utf8").trim()), c);
  assert.throws(
    () =>
      conceder(
        { de: "Norte", para: "Regua", escopo: "x", motivo: "y", horas: "25" },
        f,
        agora
      ),
    /24/
  );
  assert.throws(
    () =>
      conceder(
        { de: "Norte", para: "Norte", escopo: "x", motivo: "y", horas: "1" },
        f,
        agora
      ),
    /si mesmo/
  );
  assert.throws(
    () =>
      conceder(
        { de: "Norte", para: "Regua", escopo: "x", horas: "1" },
        f,
        agora
      ),
    /motivo/
  );
});

test("concessoes lista só as ativas, e filtra por quem recebeu", () => {
  const f = arquivo();
  conceder(
    { de: "Ordem", para: "Caixa", escopo: "a", motivo: "m", horas: "2" },
    f,
    agora
  );
  conceder(
    { de: "Morgana", para: "Orbita", escopo: "b", motivo: "m", horas: "1" },
    f,
    new Date(agora - 2 * 36e5)
  );
  conceder(
    { de: "Morgana", para: "Selo", escopo: "c", motivo: "m", horas: "3" },
    f,
    agora
  );
  assert.deepEqual(
    concessoes(f, agora).map((c) => c.para),
    ["Caixa", "Selo"]
  );
  assert.deepEqual(
    concessoes(f, agora, "Selo").map((c) => c.escopo),
    ["c"]
  );
});

test("resumo sem eventos na janela sai 1: a retro é pulada", () => {
  assert.deepEqual(resumo(arquivo(), 7, agora), { code: 1, out: "" });
});

const pedidos = () =>
  join(mkdtempSync(join(tmpdir(), "pedidos-")), "pedidos.jsonl");
const h = (horas) => new Date(agora.getTime() - horas * 36e5);

test("pedido exige de, para, tarefa e um estado da lista", () => {
  const f = pedidos();
  assert.throws(
    () => pedido({ de: "Norte", para: "Regua", estado: "aberto" }, f),
    /tarefa/
  );
  assert.throws(
    () =>
      pedido({ de: "Norte", para: "Regua", tarefa: "x", estado: "talvez" }, f),
    /estado deve ser/
  );
  const e = pedido(
    { de: "Norte", para: "Regua", tarefa: "spec", estado: "aberto" },
    f,
    agora
  );
  assert.deepEqual(e, {
    ts: "2026-09-25T12:00:00.000Z",
    de: "Norte",
    para: "Regua",
    tarefa: "spec",
    estado: "aberto",
  });
});

test("resumo de pedidos: quantos voltaram, por quem pediu, mediana até fechar e parados", () => {
  const f = pedidos();
  // Norte → Regua: voltou uma vez, fechou em 4 h.
  pedido(
    { de: "Norte", para: "Regua", tarefa: "Spec do raio X", estado: "aberto" },
    f,
    h(10)
  );
  pedido(
    { de: "Norte", para: "Regua", tarefa: "spec do raio x ", estado: "voltou" },
    f,
    h(9)
  );
  pedido(
    { de: "Norte", para: "Regua", tarefa: "spec do raio X", estado: "fechado" },
    f,
    h(6)
  );
  // Ordem → Caixa: fechou em 2 h, sem volta.
  pedido(
    {
      de: "Ordem",
      para: "Caixa",
      tarefa: "caixa 13 semanas",
      estado: "aberto",
    },
    f,
    h(5)
  );
  pedido(
    {
      de: "Ordem",
      para: "Caixa",
      tarefa: "caixa 13 semanas",
      estado: "fechado",
    },
    f,
    h(3)
  );
  // Morgana → Pilar: aberto há 30 h, parado.
  pedido(
    { de: "Morgana", para: "Pilar", tarefa: "subir memória", estado: "aberto" },
    f,
    h(30)
  );
  const { code, out } = resumoPedidos(f, 7, agora);
  assert.equal(code, 0);
  assert.match(
    out,
    /3 abertos em 7 dias, 2 fechados, 1 voltaram com pergunta \(33%\)/
  );
  assert.match(out, /mediana\): 3\.0 h/);
  assert.match(out, /por quem pediu: Norte 1/);
  assert.match(
    out,
    /Abertos há mais de 24 h:\n- Morgana → Pilar: subir memória/
  );
});

test("resumo de pedidos sem eventos na janela sai 1", () => {
  assert.deepEqual(resumoPedidos(pedidos(), 7, agora), { code: 1, out: "" });
});
