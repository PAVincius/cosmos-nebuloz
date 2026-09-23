// node --test .maestri/jev.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, perguntas, triagem, triar } from "./jev.mjs";

const c = (sha, files = ["apps/app/x.ts"]) => ({ sha, subject: `msg ${sha}`, files, diff: "d" });

const fakeGit = (log) => (args) => {
  if (args[0] === "log") return log;
  if (args.includes("--name-only")) return args.at(-1) === "b2" ? "packages/database/prisma/schema/charter.prisma\n" : "apps/app/x.ts\n";
  return "diff";
};

test("ask fala o protocolo do Gateway: boolean, retenção zero, probability vira p", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init };
    return new Response(JSON.stringify({ answers: { q: { probability: 0.9 } }, providerMetadata: { typesafe: { confidence: { q: 0.8 } } } }));
  };
  const r = await ask({ s: 1 }, { q: { type: "noul", instructions: "x" } }, { key: "k", fetchImpl });
  assert.equal(sent.url, "https://ai-gateway.vercel.sh/v4/ai/evaluation-model");
  assert.equal(sent.init.headers["ai-model-id"], "typesafe-ai/jev");
  const body = JSON.parse(sent.init.body);
  assert.equal(body.questions.q.type, "boolean");
  assert.deepEqual(body.providerOptions, { gateway: { zeroDataRetention: true } });
  assert.deepEqual(r, { q: { p: 0.9, confidence: 0.8 } });
});

test("ask sem chave falha antes de qualquer rede", async () => {
  await assert.rejects(ask({}, {}, { key: "", fetchImpl: () => assert.fail("chamou a rede") }), /AI_GATEWAY_API_KEY/);
});

test("perguntas: uma por área por commit, numa chamada só", () => {
  assert.deepEqual(Object.keys(perguntas([c("a1"), c("b2")])), ["vigia_a1", "lacre_a1", "vigia_b2", "lacre_b2"]);
});

test("triar: limiar roteia, zona incerta pede decisão, baixo some, schema é determinístico", () => {
  const linhas = triar([c("a1"), c("b2", ["packages/database/prisma/schema/charter.prisma"])], {
    vigia_a1: { p: 0.93, confidence: 0.9 },
    lacre_a1: { p: 0.1, confidence: 0.9 },
    vigia_b2: { p: 0.8, confidence: 0.2 }, // p alto mas confiança baixa → incerto
    lacre_b2: { p: 0.5 },
  });
  assert.deepEqual(linhas, [
    'a1 "msg a1" → Vigia (recrute o Security Reviewer) (p=0.93)',
    'b2 "msg b2" → Vigia (recrute o Security Reviewer)? incerto (p=0.80, confiança=0.20): decida',
    'b2 "msg b2" → Lacre (parecer de Compliance)? incerto (p=0.50, confiança=1.00): decida',
    'b2 "msg b2" → Pilar (mudou schema: Plataforma escreve, Infra aplica)',
  ]);
});

test("triagem sem commits sai 1 e não chama o Jev", async () => {
  const r = await triagem("1 hour ago", { git: fakeGit(""), key: "k", fetchImpl: () => assert.fail("chamou a rede") });
  assert.deepEqual(r, { code: 1, out: "" });
});

test("triagem com tudo baixo sai 1: ninguém acorda", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ answers: { vigia_a1: { probability: 0.05, confidence: 0.9 }, lacre_a1: { probability: 0.02, confidence: 0.9 } } }));
  const r = await triagem("1 hour ago", { git: fakeGit("a1\tmsg a1\n"), key: "k", fetchImpl });
  assert.equal(r.code, 1);
});

test("triagem falha aberta: Gateway fora entrega a lista crua", async () => {
  const fetchImpl = async () => new Response("boom", { status: 503 });
  const r = await triagem("1 hour ago", { git: fakeGit("a1\tmsg a1\nb2\tmsg b2\n"), key: "k", fetchImpl });
  assert.equal(r.code, 0);
  assert.match(r.out, /Triagem Jev falhou \(Gateway HTTP 503/);
  assert.match(r.out, /a1 "msg a1"\nb2 "msg b2"/);
});
