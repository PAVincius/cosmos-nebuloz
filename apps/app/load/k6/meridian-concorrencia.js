// Concorrência do Meridian (SC-011 do PRD; spec 007). Distinta do SC-010, que
// mede volume com um usuário. Escopo ajustado pelo Norte, 2026-09-27: o pico de
// concorrência do Meridian é a ONDA DE RESPONDENTES abrindo a bateria depois de
// um envio em lote, não o PI Planning dos consultores (esse é pico do Cosmos).
// Dois cenários, medidos e reportados separados:
//
//   a) "consultores"  — carteira (/meridian) e detalhe do assessment
//      (/meridian/assessment/:id, aba Coleta) sob acesso concorrente.
//   b) "respondentes" — onda de respondentes simultâneos em
//      /meridian-responder/<token>, abrindo a bateria e salvando respostas
//      (server action `saveDraft`).
//
// Usa a biblioteca comum em ./lib (trava de alvo, tetos, meta, relatório). O
// alvo é localhost:3012 por padrão; produção (`*.nebuloz.ai`) é sempre
// recusada; alvo remoto exige as três variáveis descritas em lib/target.js e
// cai nos tetos de lib/options.js.
//
// Server actions: HTTP puro, cabeçalho `Next-Action: <id>`. O id vem do
// fixture, gravado pelo seed a partir do manifesto do build (muda a cada
// build): rode o seed DEPOIS de o app ter compilado a tela do respondente.
//
// Pré-requisito (nunca tokens de produção; o fixture é ignorado pelo git):
//   cd apps/app && pnpm seed:meridian:concorrencia
// Rodar:
//   k6 run apps/app/load/k6/meridian-concorrencia.js
import { check, fail } from "k6";
import { SharedArray } from "k6/data";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";
import { limitsFor, p95Threshold } from "./lib/options.js";
import { makeSummary } from "./lib/report.js";
import { requestParams, resolveTarget } from "./lib/target.js";

const target = resolveTarget(__ENV);
const limits = limitsFor(target);

const fixture = new SharedArray("meridian-concorrencia", () => {
  const raw = open("./.fixtures/meridian-concorrencia.json");
  return [JSON.parse(raw)];
})[0];

if (!fixture.saveDraftActionId) {
  fail(
    "fixture sem saveDraftActionId: suba o app, abra /meridian-responder/<token> uma vez e rode de novo `pnpm seed:meridian:concorrencia`."
  );
}

// Métricas por cenário (relatório de p95/erro separado por onda).
const consultorDuration = new Trend("consultor_duration", true);
const consultorErrors = new Rate("consultor_errors");
const respondenteDuration = new Trend("respondente_duration", true);
const respondenteErrors = new Rate("respondente_errors");

// VUs modestos e curtos de propósito: primeiro relatório informativo, não
// validação formal. Ajustar quando o gate de maturidade fechar. Em alvo
// remoto os VUs e a duração caem nos tetos da lib.
const SECONDS = Math.min(30, limits.maxSeconds);

export const options = {
  scenarios: {
    consultores: {
      executor: "constant-vus",
      exec: "consultores",
      vus: Math.min(10, limits.maxVus),
      duration: `${SECONDS}s`,
      tags: { cenario: "consultores" },
    },
    respondentes: {
      executor: "constant-vus",
      exec: "respondentes",
      vus: Math.min(30, limits.maxVus),
      duration: `${SECONDS}s`,
      tags: { cenario: "respondentes" },
      startTime: "5s", // não sobrepõe o login do setup
    },
  },
  thresholds: {
    // Critério de aprovação do SC-011 (hipótese do PRD): p95 < 2 s e erro < 1 %
    // por cenário.
    consultor_duration: [p95Threshold(2000)],
    consultor_errors: ["rate<0.01"],
    respondente_duration: [p95Threshold(2000)],
    respondente_errors: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

export const handleSummary = makeSummary("meridian-concorrencia", [], __ENV, [
  {
    label: "consultores",
    trend: "consultor_duration",
    errors: "consultor_errors",
  },
  {
    label: "respondentes",
    trend: "respondente_duration",
    errors: "respondente_errors",
  },
]);

export function setup() {
  const loginRes = http.post(
    `${target.baseUrl}/api/auth/sign-in/email`,
    JSON.stringify({
      email: fixture.consultant.email,
      password: fixture.consultant.password,
    }),
    requestParams(target, __ENV, {
      headers: { "Content-Type": "application/json" },
    })
  );
  if (loginRes.status !== 200) {
    fail(
      `setup: login da consultora falhou (status ${loginRes.status}). Rodou pnpm seed:meridian:concorrencia?`
    );
  }
  const setCookies = loginRes.headers["Set-Cookie"];
  const cookieHeader = Array.isArray(setCookies)
    ? setCookies.map((c) => c.split(";")[0]).join("; ")
    : String(setCookies).split(";")[0];

  return {
    consultantCookie: cookieHeader,
    assessmentId: fixture.assessmentId,
    respondents: fixture.respondents,
    questionsByAxis: fixture.questionsByAxis,
  };
}

// a) Consultores: carteira + detalhe do assessment (aba Coleta). Sessão única
// da consultora reaproveitada por todos os VUs deste cenário (uma consultora
// com várias abas concorrentes é a leitura mais honesta do que o seed simula
// sem plantar N consultoras).
export function consultores(data) {
  const params = (name) =>
    requestParams(target, __ENV, {
      headers: { Cookie: data.consultantCookie },
      tags: { name },
    });

  let res = http.get(`${target.baseUrl}/meridian`, params("GET /meridian"));
  consultorDuration.add(res.timings.duration);
  consultorErrors.add(res.status !== 200);
  check(res, { "carteira 200": (r) => r.status === 200 });

  res = http.get(
    `${target.baseUrl}/meridian/assessment/${data.assessmentId}`,
    params("GET /meridian/assessment/:id")
  );
  consultorDuration.add(res.timings.duration);
  consultorErrors.add(res.status !== 200);
  check(res, { "detalhe 200": (r) => r.status === 200 });
}

// b) Onda de respondentes: abre a bateria (GET, sem sessão, o tenant sai do
// token) e salva respostas em duas rodadas (autosave progressivo), pela server
// action `saveDraft` chamada por HTTP puro com Next-Action.
function salvar(url, token, answers, name) {
  const res = http.post(
    url,
    JSON.stringify([{ token, answers }]),
    requestParams(target, __ENV, {
      headers: {
        Accept: "text/x-component",
        "Next-Action": fixture.saveDraftActionId,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      tags: { name },
    })
  );
  const ok = res.status === 200 && res.body.indexOf('"ok":true') !== -1;
  respondenteDuration.add(res.timings.duration);
  respondenteErrors.add(!ok);
  check(res, { [`${name} ok`]: () => ok });
}

export function respondentes(data) {
  const r =
    data.respondents[Math.floor(Math.random() * data.respondents.length)];
  const questionIds = data.questionsByAxis[r.axis];
  const url = `${target.baseUrl}/meridian-responder/${r.token}`;

  const res = http.get(
    url,
    requestParams(target, __ENV, {
      tags: { name: "GET /meridian-responder/:token" },
    })
  );
  respondenteDuration.add(res.timings.duration);
  respondenteErrors.add(res.status !== 200);
  check(res, { "bateria 200": (x) => x.status === 200 });

  // Rodada 1: primeira pergunta respondida. Rodada 2: o restante do eixo.
  salvar(
    url,
    r.token,
    [{ questionId: questionIds[0], rawValue: 2 }],
    "POST saveDraft (parcial)"
  );
  salvar(
    url,
    r.token,
    questionIds.slice(1).map((id) => ({ questionId: id, rawValue: 2 })),
    "POST saveDraft (resto)"
  );
}
