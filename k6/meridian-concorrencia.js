/**
 * k6/meridian-concorrencia.js
 *
 * SC-011 do Meridian (specs/007-gate-maturidade-carga/) — concorrência,
 * distinta do SC-010 (volume). Escopo ajustado pelo Norte, 2026-09-27: o
 * pico de concorrência do Meridian é a ONDA DE RESPONDENTES abrindo a
 * bateria depois de um envio em lote — não o PI Planning dos consultores
 * (esse é pico do Cosmos). Dois cenários, medidos e reportados separados:
 *
 *   a) "consultores"  — carteira (/meridian) e detalhe do assessment
 *      (/meridian/assessment/:id, aba Coleta) sob acesso concorrente.
 *   b) "respondentes" — onda de respondentes simultâneos em
 *      /meridian-responder/<token>, abrindo a bateria e salvando respostas
 *      (Server Action `saveDraft`).
 *
 * Mecanismo das Server Actions (decisão do Maestro, research.md §4): HTTP
 * puro, cabeçalho `Next-Action: <id>`, IDs resolvidos de
 * `.next/server/server-reference-manifest.json` no setup (mudam a cada
 * build). Formato do corpo e headers confirmados batendo com o próprio
 * Next.js: `curl`/fetch patchado num Chromium real contra este mesmo build,
 * ver `.claude/completions/2026-09-27-spec-007-t006-t008.md`.
 *
 * Pré-requisito: `pnpm seed:meridian:concorrencia` rodado contra o alvo
 * (planta a persona consultora e os tokens de respondente em
 * `k6/.fixtures/meridian-concorrencia.json` — nunca tokens de produção).
 *
 *   BASE_URL=http://localhost:3012 k6 run k6/meridian-concorrencia.js
 */

import { check } from "k6";
import { SharedArray } from "k6/data";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

// ─── Guard contra produção (docs/runbooks/k6-carga.md) ──────────────────────
const BLOCKED_HOST_SUFFIXES = [".nebuloz.ai", ".vercel.app"];
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function hostnameOf(rawUrl) {
  // Sem `URL` global no runtime do k6 (Goja) — parse manual, sem porta/path.
  const withoutScheme = rawUrl.replace(/^[a-z]+:\/\//i, "");
  const hostPort = withoutScheme.split("/")[0];
  return hostPort.startsWith("[")
    ? hostPort.slice(1, hostPort.indexOf("]")) // IPv6, ex.: [::1]:3012
    : hostPort.split(":")[0];
}

function assertLocalTarget(baseUrl) {
  const host = hostnameOf(baseUrl);
  const blocked = BLOCKED_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  );
  if (blocked || !ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `k6 recusa rodar: BASE_URL aponta pra "${host}", não localhost/127.0.0.1/::1.`
    );
  }
}

const BASE_URL = __ENV.BASE_URL || "http://localhost:3012";
assertLocalTarget(BASE_URL);

// IDs de Server Action do build alvo — lidos de .next/server/server-reference-manifest.json
// no setup (não hardcoded no topo do arquivo: mudam a cada build).
function findActionId(manifest, exportedName, filenameSuffix) {
  const node = manifest.node;
  for (const id of Object.keys(node)) {
    const workers = node[id].workers || {};
    for (const route of Object.keys(workers)) {
      const w = workers[route];
      if (
        w.exportedName === exportedName &&
        w.filename.endsWith(filenameSuffix)
      ) {
        return id;
      }
    }
  }
  throw new Error(
    `Server Action "${exportedName}" (${filenameSuffix}) não encontrada no manifest — build mudou de forma?`
  );
}

const fixture = new SharedArray("meridian-concorrencia", () => {
  const raw = open("./.fixtures/meridian-concorrencia.json");
  return [JSON.parse(raw)];
})[0];

const manifest = JSON.parse(
  open("../apps/app/.next/server/server-reference-manifest.json")
);
const SAVE_DRAFT_ACTION_ID = findActionId(
  manifest,
  "saveDraft",
  "respondent.ts"
);

// ─── Métricas por cenário (relatório p95/erro separado) ─────────────────────
const consultorDuration = new Trend("consultor_duration", true);
const consultorErrors = new Rate("consultor_errors");
const respondenteDuration = new Trend("respondente_duration", true);
const respondenteErrors = new Rate("respondente_errors");

// ─── Cenários ─────────────────────────────────────────────────────────────
// VUs modestos e curtos de propósito — primeiro relatório informativo
// (T008), não validação formal: o Meridian não está apto no gate de
// maturidade hoje (docs/qualidade/gate-maturidade-carga.md, C2 falha por um
// P1 ativo). Ajustar VUs/duration quando o gate fechar e isto virar
// execução formal contra o SC-011.
export const options = {
  scenarios: {
    consultores: {
      executor: "constant-vus",
      exec: "consultores",
      vus: 10,
      duration: "30s",
      tags: { cenario: "consultores" },
    },
    respondentes: {
      executor: "constant-vus",
      exec: "respondentes",
      vus: 30,
      duration: "30s",
      tags: { cenario: "respondentes" },
      startTime: "5s", // não sobrepõe o login do setup
    },
  },
  thresholds: {
    // Critério de aprovação do SC-011 (hipótese, meridian-prd.md:164):
    // p95 < 2s, erro < 1% — aplicado por cenário.
    consultor_duration: ["p(95)<2000"],
    consultor_errors: ["rate<0.01"],
    respondente_duration: ["p(95)<2000"],
    respondente_errors: ["rate<0.01"],
  },
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    JSON.stringify({
      email: fixture.consultant.email,
      password: fixture.consultant.password,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
  if (loginRes.status !== 200) {
    throw new Error(
      `setup: login da consultora falhou (status ${loginRes.status}) — rodou pnpm seed:meridian:concorrencia?`
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

// a) Consultores — carteira + detalhe do assessment (aba Coleta), sessão
// única da consultora reaproveitada por todas as VUs deste cenário (uma
// consultora com várias abas concorrentes é a leitura mais honesta do que
// este seed consegue simular sem plantar N consultoras distintas).
export function consultores(data) {
  const headers = { Cookie: data.consultantCookie };

  let res = http.get(`${BASE_URL}/meridian`, {
    headers,
    tags: { name: "GET /meridian" },
  });
  consultorDuration.add(res.timings.duration);
  consultorErrors.add(res.status !== 200);
  check(res, { "carteira 200": (r) => r.status === 200 });

  res = http.get(`${BASE_URL}/meridian/assessment/${data.assessmentId}`, {
    headers,
    tags: { name: "GET /meridian/assessment/:id" },
  });
  consultorDuration.add(res.timings.duration);
  consultorErrors.add(res.status !== 200);
  check(res, { "detalhe 200": (r) => r.status === 200 });
}

// b) Onda de respondentes — abre a bateria (GET, sem sessão — o tenant sai
// do token) e salva respostas em duas rodadas (autosave progressivo), via
// Server Action `saveDraft` chamada por HTTP puro com Next-Action.
export function respondentes(data) {
  const r =
    data.respondents[Math.floor(Math.random() * data.respondents.length)];
  const questionIds = data.questionsByAxis[r.axis];

  let res = http.get(`${BASE_URL}/meridian-responder/${r.token}`, {
    tags: { name: "GET /meridian-responder/:token" },
  });
  respondenteDuration.add(res.timings.duration);
  respondenteErrors.add(res.status !== 200);
  check(res, { "bateria 200": (r) => r.status === 200 });

  const actionHeaders = {
    Accept: "text/x-component",
    "Next-Action": SAVE_DRAFT_ACTION_ID,
    "Content-Type": "text/plain;charset=UTF-8",
  };

  // Rodada 1 — primeira pergunta respondida.
  res = http.post(
    `${BASE_URL}/meridian-responder/${r.token}`,
    JSON.stringify([
      {
        token: r.token,
        answers: [{ questionId: questionIds[0], rawValue: 2 }],
      },
    ]),
    { headers: actionHeaders, tags: { name: "POST saveDraft (parcial)" } }
  );
  respondenteDuration.add(res.timings.duration);
  const ok1 = res.status === 200 && res.body.indexOf('"ok":true') !== -1;
  respondenteErrors.add(!ok1);
  check(res, { "saveDraft parcial ok": () => ok1 });

  // Rodada 2 — restante das perguntas do eixo.
  const resto = questionIds
    .slice(1)
    .map((id) => ({ questionId: id, rawValue: 2 }));
  res = http.post(
    `${BASE_URL}/meridian-responder/${r.token}`,
    JSON.stringify([{ token: r.token, answers: resto }]),
    { headers: actionHeaders, tags: { name: "POST saveDraft (resto)" } }
  );
  respondenteDuration.add(res.timings.duration);
  const ok2 = res.status === 200 && res.body.indexOf('"ok":true') !== -1;
  respondenteErrors.add(!ok2);
  check(res, { "saveDraft resto ok": () => ok2 });
}
