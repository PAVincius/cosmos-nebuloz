// node --test .maestri/jev.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, commits, lotes, perguntas, triagem, triar } from "./jev.mjs";

const c = (sha, files = ["apps/app/x.ts"]) => ({
  sha,
  subject: `msg ${sha}`,
  files,
  diff: "d",
});

const fakeGit = (log) => (args) => {
  if (args[0] === "log") {
    return log;
  }
  if (args.includes("--name-only")) {
    return args.at(-1) === "b2"
      ? "packages/database/prisma/schema/charter.prisma\n"
      : "apps/app/x.ts\n";
  }
  return "diff";
};

test("ask fala o protocolo do Gateway: boolean, retenção zero, probability vira p", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init };
    return Response.json({
      answers: { q: { probability: 0.9 } },
      providerMetadata: { typesafe: { confidence: { q: 0.8 } } },
    });
  };
  const r = await ask(
    { s: 1 },
    { q: { type: "noul", instructions: "x" } },
    { key: "k", fetchImpl }
  );
  assert.equal(sent.url, "https://ai-gateway.vercel.sh/v4/ai/evaluation-model");
  assert.equal(sent.init.headers["ai-model-id"], "typesafe-ai/jev");
  const body = JSON.parse(sent.init.body);
  assert.equal(body.questions.q.type, "boolean");
  assert.deepEqual(body.providerOptions, {
    gateway: { zeroDataRetention: true },
  });
  assert.deepEqual(r, { q: { p: 0.9, confidence: 0.8 } });
});

test("ask tenta de novo em 503/429 e desiste na terceira", async () => {
  let n = 0;
  const flaky = async () => {
    n += 1;
    return n < 3
      ? new Response("busy", { status: 503 })
      : Response.json({ answers: { q: { probability: 0.6 } } });
  };
  assert.deepEqual(
    await ask(
      {},
      { q: { type: "noul", instructions: "x" } },
      { key: "k", fetchImpl: flaky, espera: 0 }
    ),
    { q: { p: 0.6, confidence: undefined } }
  );
  assert.equal(n, 3);
  n = 0;
  const sempre = async () => {
    n += 1;
    return new Response("busy", { status: 503 });
  };
  await assert.rejects(
    ask({}, {}, { key: "k", fetchImpl: sempre, espera: 0 }),
    /503/
  );
  assert.equal(n, 3);
  n = 0;
  const ruim = async () => {
    n += 1;
    return new Response("bad", { status: 400 });
  };
  await assert.rejects(
    ask({}, {}, { key: "k", fetchImpl: ruim, espera: 0 }),
    /400/
  );
  assert.equal(n, 1);
});

test("ask sem chave falha antes de qualquer rede", async () => {
  await assert.rejects(
    ask({}, {}, { key: "", fetchImpl: () => assert.fail("chamou a rede") }),
    /AI_GATEWAY_API_KEY/
  );
});

test("perguntas: uma por área por commit, numa chamada só", () => {
  assert.deepEqual(Object.keys(perguntas([c("a1"), c("b2")])), [
    "vigia_a1",
    "lacre_a1",
    "vigia_b2",
    "lacre_b2",
  ]);
});

test("triar: limiar roteia, zona incerta pede decisão, baixo some, schema é determinístico", () => {
  const linhas = triar(
    [c("a1"), c("b2", ["packages/database/prisma/schema/charter.prisma"])],
    {
      vigia_a1: { p: 0.93, confidence: 0.9 },
      lacre_a1: { p: 0.1, confidence: 0.9 },
      vigia_b2: { p: 0.8, confidence: 0.2 }, // p alto mas confiança baixa → incerto
      lacre_b2: { p: 0.5 },
    }
  );
  assert.deepEqual(linhas, [
    'a1 "msg a1" → Vigia (recrute o Security Reviewer) (p=0.93)',
    'b2 "msg b2" → Vigia (recrute o Security Reviewer)? incerto (p=0.80, confiança=0.20): decida',
    'b2 "msg b2" → Lacre (parecer de Compliance)? incerto (p=0.50, confiança=1.00): decida',
    'b2 "msg b2" → Pilar (mudou schema: Plataforma escreve, Infra aplica)',
  ]);
});

test("triagem sem commits sai 1 e não chama o Jev", async () => {
  const r = await triagem("1 hour ago", {
    git: fakeGit(""),
    key: "k",
    fetchImpl: () => assert.fail("chamou a rede"),
  });
  assert.deepEqual(r, { code: 1, out: "" });
});

test("triagem com tudo baixo sai 1: ninguém acorda", async () => {
  const fetchImpl = async () =>
    Response.json({
      answers: {
        vigia_a1: { probability: 0.05, confidence: 0.9 },
        lacre_a1: { probability: 0.02, confidence: 0.9 },
      },
    });
  const r = await triagem("1 hour ago", {
    git: fakeGit("a1\tmsg a1\n"),
    key: "k",
    fetchImpl,
  });
  assert.equal(r.code, 1);
});

test("lotes: cada chamada fica em ~12k chars (o Gateway devolve 503 em lote grande sob carga)", () => {
  const cs = Array.from({ length: 30 }, (_, i) => ({
    ...c(`s${i}`),
    diff: "x".repeat(2500),
  }));
  const ls = lotes(cs);
  assert.ok(ls.length > 1);
  assert.equal(ls.flat().length, 30);
  for (const l of ls) {
    assert.ok(JSON.stringify(l).length <= 12_000);
  }
});

test("triagem com muitos commits faz uma chamada por lote, em sequência, e junta as respostas", async () => {
  const log = Array.from({ length: 30 }, (_, i) => `s${i}\tmsg s${i}`).join(
    "\n"
  );
  const git = (args) => {
    if (args[0] === "log") {
      return log;
    }
    return args.includes("--name-only") ? "apps/app/x.ts\n" : "x".repeat(9000);
  };
  let calls = 0;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    const ids = Object.keys(JSON.parse(init.body).questions);
    return Response.json({
      answers: Object.fromEntries(
        ids.map((id) => [id, { probability: id === "vigia_s29" ? 0.95 : 0.01 }])
      ),
    });
  };
  const r = await triagem("1 day ago", { git, key: "k", fetchImpl });
  assert.ok(calls > 1);
  assert.equal(r.code, 0);
  assert.match(r.out, /s29 "msg s29" → Vigia/);
});

test("diff ignora arquivo gerado (grafo de conhecimento, lockfile)", () => {
  const seen = [];
  commits("1 day ago", (args) => {
    seen.push(args);
    return args[0] === "log" ? "a1\tmsg\n" : "";
  });
  const diffArgs = seen.find((a) => a.includes("--unified=2"));
  assert.ok(diffArgs.includes(":(exclude).maestri/knowledge"));
  assert.ok(diffArgs.includes(":(exclude)pnpm-lock.yaml"));
});

test("triagem falha aberta também quando o git quebra: nunca sai 1 calada", async () => {
  const git = () => {
    throw new Error("ENOBUFS");
  };
  const r = await triagem("1 day ago", {
    git,
    key: "k",
    fetchImpl: () => assert.fail("chamou a rede"),
  });
  assert.equal(r.code, 0);
  assert.match(r.out, /Triagem falhou ao ler o git \(ENOBUFS\)/);
});

test("triagem falha aberta: Gateway fora entrega a lista crua", async () => {
  const fetchImpl = async () => new Response("boom", { status: 503 });
  const r = await triagem("1 hour ago", {
    git: fakeGit("a1\tmsg a1\nb2\tmsg b2\n"),
    key: "k",
    fetchImpl,
  });
  assert.equal(r.code, 0);
  assert.match(r.out, /Triagem Jev falhou \(Gateway HTTP 503/);
  assert.match(r.out, /a1 "msg a1"\nb2 "msg b2"/);
});
