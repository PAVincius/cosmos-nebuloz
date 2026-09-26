// node --test .maestri/jev.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  ask,
  commits,
  houveCommit,
  lotes,
  perguntas,
  repos,
  triagem,
  triar,
} from "./jev.mjs";

// Testes não leem o disco real: um "workspace" só, sem andares.
const ONDE = ["/ws"];

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
    onde: ONDE,
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
    onde: ONDE,
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
  const r = await triagem("1 day ago", {
    onde: ONDE,
    git,
    key: "k",
    fetchImpl,
  });
  assert.ok(calls > 1);
  assert.equal(r.code, 0);
  assert.match(r.out, /s29 "msg s29" → Vigia/);
});

test("diff ignora arquivo gerado (grafo de conhecimento, lockfile)", () => {
  const seen = [];
  commits(
    "1 day ago",
    (args) => {
      seen.push(args);
      return args[0] === "log" ? "a1\tmsg\n" : "";
    },
    ONDE
  );
  const diffArgs = seen.find((a) => a.includes("--unified=2"));
  assert.ok(diffArgs.includes(":(exclude).maestri/knowledge"));
  assert.ok(diffArgs.includes(":(exclude)pnpm-lock.yaml"));
});

test("triagem falha aberta também quando o git quebra: nunca sai 1 calada", async () => {
  const git = () => {
    throw new Error("ENOBUFS");
  };
  const r = await triagem("1 day ago", {
    onde: ONDE,
    git,
    key: "k",
    fetchImpl: () => assert.fail("chamou a rede"),
  });
  assert.equal(r.code, 0);
  assert.match(r.out, /Triagem falhou ao ler o git \(ENOBUFS\)/);
});

// Andares do Maestri: clone completo, com .git próprio, em <pai>/.maestri/floors/<repo>--<branch>.
test("repos: o Ground e só os andares deste repo", () => {
  const pai = mkdtempSync(join(tmpdir(), "maestri-"));
  const ws = join(pai, "cosmos-nebuloz");
  mkdirSync(ws);
  mkdirSync(
    join(pai, ".maestri", "floors", "cosmos-nebuloz--featmeeting-ingest"),
    { recursive: true }
  );
  mkdirSync(join(pai, ".maestri", "floors", "outro-repo--feat-x"), {
    recursive: true,
  });
  assert.deepEqual(repos(ws), [
    ws,
    join(pai, ".maestri", "floors", "cosmos-nebuloz--featmeeting-ingest"),
  ]);
  assert.deepEqual(repos(join(pai, "sem-andares")), [join(pai, "sem-andares")]);
});

test("commits lê Ground e andares, marca o andar e não repete commit já aterrissado", () => {
  const logs = {
    "/ws": "a1\tno ground\nc3\tja aterrissado\n",
    "/floors/ws--feat": "b2\tno andar\nc3\tja aterrissado\n",
  };
  const git = (args, cwd) => {
    if (args[0] === "log") {
      return logs[cwd];
    }
    return args.includes("--name-only") ? `${cwd}/x.ts\n` : "diff";
  };
  const cs = commits("1 day ago", git, ["/ws", "/floors/ws--feat"]);
  assert.deepEqual(
    cs.map((c) => [c.sha, c.andar]),
    [
      ["a1", undefined],
      ["c3", undefined],
      ["b2", "ws--feat"],
    ]
  );
  assert.deepEqual(cs[2].files, ["/floors/ws--feat/x.ts"]);
});

test("triar diz de qual andar veio o commit", () => {
  const linhas = triar(
    [{ sha: "b2", subject: "msg", files: [], diff: "", andar: "ws--feat" }],
    {
      vigia_b2: { p: 0.9 },
    }
  );
  assert.deepEqual(linhas, [
    'b2 [andar ws--feat] "msg" → Vigia (recrute o Security Reviewer) (p=0.90)',
  ]);
});

test("houveCommit olha todos os repos e só o log", () => {
  const git = (args, cwd) => {
    assert.equal(args[0], "log");
    return cwd === "/floors/ws--feat" ? "b2\tmsg\n" : "";
  };
  assert.equal(houveCommit("midnight", git, ["/ws", "/floors/ws--feat"]), true);
  assert.equal(
    houveCommit("midnight", () => "", ["/ws"]),
    false
  );
});

test("triagem falha aberta: Gateway fora entrega a lista crua", async () => {
  const fetchImpl = async () => new Response("boom", { status: 503 });
  const r = await triagem("1 hour ago", {
    onde: ONDE,
    git: fakeGit("a1\tmsg a1\nb2\tmsg b2\n"),
    key: "k",
    fetchImpl,
  });
  assert.equal(r.code, 0);
  assert.match(r.out, /Triagem Jev falhou \(Gateway HTTP 503/);
  assert.match(r.out, /a1 "msg a1"\nb2 "msg b2"/);
});
