// biome-ignore-all lint/correctness/noUndeclaredVariables: __ENV e __VU são globais do k6
// Carga do respondente do Meridian: pessoas sem conta abrindo o link
// (/meridian-responder/<token>) e gravando respostas (server action saveDraft).
//
// SÓ LOCAL. O alvo é http://localhost:3012 e o script se recusa a rodar contra
// outro host. Rampa de 1 a 50 VUs em 3 minutos; cada VU é um respondente
// distinto (um token por VU), como seria com 50 pessoas abrindo os seus links.
//
// Preparo (uma vez, com o `next dev` já de pé e o responder compilado):
//   cd apps/app && npx tsx load/k6/prepare-meridian-responder.ts 50
// Rodar:
//   k6 run apps/app/load/k6/meridian-responder.js
//   k6 run -e BASE_URL=http://localhost:3012 apps/app/load/k6/meridian-responder.js
//
// Metas (thresholds): p95 < 800 ms e erro < 1 %.

import { check, fail, sleep } from "k6";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3012";

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
  fail(
    `BASE_URL fora do local: ${BASE_URL}. Este script só roda contra localhost.`
  );
}

// Gerado por prepare-meridian-responder.ts (tokens, perguntas, id da action).
const data = JSON.parse(open("./.tokens.json"));

export const options = {
  scenarios: {
    respondentes: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "60s", target: 20 },
        { duration: "60s", target: 50 },
        { duration: "60s", target: 50 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    "http_req_duration{name:abrir_link}": ["p(95)<800"],
    "http_req_duration{name:gravar_respostas}": ["p(95)<800"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

// A action é chamada como o navegador chama: POST na própria página, com o id
// da action no cabeçalho Next-Action e os argumentos em JSON.
function gravar(url, token) {
  const answers = data.questions.map((q) => ({
    questionId: q.id,
    rawValue: Math.floor(Math.random() * (q.max + 1)),
  }));
  return http.post(url, JSON.stringify([{ token, answers }]), {
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      "Next-Action": data.saveDraftActionId,
    },
    tags: { name: "gravar_respostas" },
  });
}

export default function () {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const url = `${BASE_URL}/meridian-responder/${token}`;

  const page = http.get(url, { tags: { name: "abrir_link" } });
  check(page, {
    "link abre (200)": (r) => r.status === 200,
    "sem tela de link inválido": (r) => !r.body.includes("Link inválido"),
  });

  sleep(1 + Math.random() * 2); // lê a pergunta antes de responder

  const save = gravar(url, token);
  check(save, {
    "gravar responde 200": (r) => r.status === 200,
    "gravar devolve ok": (r) => r.body.includes('"ok":true'),
  });

  sleep(1 + Math.random() * 2);
}
