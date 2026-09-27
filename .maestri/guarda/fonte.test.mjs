// node --test .maestri/guarda/fonte.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  afirmacoes,
  candidatas,
  decidir,
  guarda,
  turnoAtual,
} from "./fonte.mjs";

const j = (o) => JSON.stringify(o);
const usuario = (texto) => j({ type: "user", message: { content: texto } });
const resultado = (texto) =>
  j({
    type: "user",
    message: {
      content: [{ type: "tool_result", tool_use_id: "t", content: texto }],
    },
  });
const assistente = (texto) =>
  j({
    type: "assistant",
    message: { content: [{ type: "text", text: texto }] },
  });
const chamada = () =>
  j({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", id: "t", name: "Read", input: {} }],
    },
  });

test("turnoAtual: evidência = pedido do usuário + saídas de ferramenta do turno; final = texto depois da última ferramenta", () => {
  const linhas = [
    usuario("turno velho"),
    resultado("evidência velha"),
    assistente("resposta velha"),
    usuario("Qual o saldo da semana 13?"),
    assistente("Vou olhar o caixa."),
    chamada(),
    resultado("Saldo projetado na semana 13: R$ 42.300."),
    assistente("O saldo projetado da semana 13 é de R$ 42,3 mil."),
    "linha quebrada",
  ];
  const t = turnoAtual(linhas);
  // C-level cita número lido em turno anterior: saídas de ferramenta da sessão também contam, antes das do turno.
  assert.deepEqual(t.evidencias, [
    "evidência velha",
    "Qual o saldo da semana 13?",
    "Saldo projetado na semana 13: R$ 42.300.",
  ]);
  assert.deepEqual(t.turno, [
    "Qual o saldo da semana 13?",
    "Saldo projetado na semana 13: R$ 42.300.",
  ]);
  assert.equal(t.final, "O saldo projetado da semana 13 é de R$ 42,3 mil.");
});

test("afirmacoes: só frases com número ou verificação; ignora código e perguntas", () => {
  const texto = [
    "Olhei o caixa.",
    "O runway é de 13 semanas.",
    "A retenção zero de dados está confirmada.",
    "Quer que eu atualize o modelo?",
    "```\nconst x = 42;\n```",
    "O CAC caiu 20% no trimestre.",
  ].join(" ");
  assert.deepEqual(afirmacoes(texto), [
    "O runway é de 13 semanas.",
    "A retenção zero de dados está confirmada.",
    "O CAC caiu 20% no trimestre.",
  ]);
});

test("afirmacoes: estado de produção afirmado também é checado; regra sobre produção não", () => {
  const texto = [
    "O PR já está mergeado.",
    "A migration foi aplicada em produção.",
    "Escrita em produção precisa do seu vai.",
  ].join(" ");
  assert.deepEqual(afirmacoes(texto), [
    "O PR já está mergeado.",
    "A migration foi aplicada em produção.",
  ]);
});

test("decidir: contradição bloqueia com a evidência; sem fonte bloqueia pedindo fonte; tudo sustentado passa", () => {
  const contra = decidir([
    {
      afirmacao: "O saldo é R$ 80 mil.",
      veredito: "contradita",
      evidencia: "Saldo projetado na semana 13: R$ 42.300.",
    },
  ]);
  assert.match(contra, /contradiz/);
  assert.match(contra, /O saldo é R\$ 80 mil\./);
  assert.match(contra, /R\$ 42\.300/);
  const semFonte = decidir([
    { afirmacao: "O CAC caiu 20%.", veredito: "sem_fonte", evidencia: null },
  ]);
  assert.match(semFonte, /nenhuma saída de ferramenta recente sustenta/);
  assert.equal(
    decidir([{ afirmacao: "x", veredito: "sustentada", evidencia: "y" }]),
    null
  );
});

test("candidatas: as evidências que dividem número ou palavra com a afirmação vêm primeiro", () => {
  const ev = [
    "git status: clean",
    "Queima semanal R$ 18.000.",
    "Saldo projetado semana 13: R$ 42.300.",
  ];
  assert.deepEqual(
    candidatas("O saldo da semana 13 é R$ 42.300.", ev, 2),
    [2, 1]
  );
});

test("guarda: segundo stop do mesmo turno passa (não prende o agente em loop)", async () => {
  const r = await guarda(
    { stop_hook_active: true, transcript_path: "/nao/existe" },
    { nli: () => assert.fail("chamou o NLI") }
  );
  assert.equal(r, null);
});

test("guarda: serviço NLI fora do ar deixa passar (falha aberta)", async () => {
  const linhas = [
    usuario("saldo?"),
    resultado("Saldo: R$ 42.300."),
    assistente("O saldo é R$ 80 mil."),
  ];
  const r = await guarda(
    { stop_hook_active: false },
    {
      ler: () => linhas,
      nli: async () => {
        throw new Error("ECONNREFUSED");
      },
      registrar: () => assert.fail("registrou sem veredito"),
    }
  );
  assert.equal(r, null);
});

test('guarda: estado de produção com sinal de ferramenta passa sem NLI; "mergedAt: null" não é sinal', async () => {
  const final = assistente("O PR #261 já está mergeado.");
  const mergeado = await guarda(
    { stop_hook_active: false },
    {
      ler: () => [usuario("entrou?"), resultado("state: MERGED"), final],
      nli: () => assert.fail("chamou o NLI"),
    }
  );
  assert.equal(mergeado, null);
  let perguntou = false;
  await guarda(
    { stop_hook_active: false },
    {
      ler: () => [
        usuario("entrou?"),
        resultado("state: OPEN\nmergedAt: null"),
        final,
      ],
      nli: async () => {
        perguntou = true;
        return { veredito: "contradita", melhor: { i: 0 } };
      },
      registrar: () => {},
      papel: "Morgana",
    }
  );
  assert.equal(perguntou, true);
});

test("guarda: contradição bloqueia e vira registro de achado", async () => {
  const linhas = [
    usuario("saldo?"),
    resultado("Saldo: R$ 42.300."),
    assistente("O saldo é R$ 80 mil."),
  ];
  const registros = [];
  const r = await guarda(
    { stop_hook_active: false },
    {
      ler: () => linhas,
      nli: async () => ({ veredito: "contradita", melhor: { i: 1 } }),
      registrar: (e) => registros.push(e),
      papel: "CFO",
    }
  );
  assert.equal(r.decision, "block");
  assert.match(r.reason, /contradiz/);
  assert.deepEqual(
    registros.map((e) => [e.agente, e.veredito, e.causa]),
    [["CFO", "achado", "afirmação contradita pela evidência"]]
  );
});
