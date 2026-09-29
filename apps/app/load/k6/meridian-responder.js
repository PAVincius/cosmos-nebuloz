// Carga do respondente do Meridian: pessoas sem conta abrindo o link
// (/meridian-responder/<token>) e gravando respostas (server action saveDraft).
//
// Usa a biblioteca comum em ./lib (trava de alvo, rampa, metas, relatório).
// Para criar o script de outro produto, ver README.md nesta pasta.
//
// Padrão: só localhost:3012, rampa de 1 a 50 VUs em 3 minutos, um respondente
// (token) por VU, metas p95 < 800 ms e erro < 1 %.
//
// Preparo (uma vez, com o `next dev` ou `next start` já de pé e o responder
// compilado):
//   cd apps/app && npx tsx load/k6/prepare-meridian-responder.ts 50
// Rodar:
//   k6 run apps/app/load/k6/meridian-responder.js
import { check, sleep } from "k6";
import http from "k6/http";
import { buildOptions } from "./lib/options.js";
import { makeSummary } from "./lib/report.js";
import { requestParams, resolveTarget } from "./lib/target.js";

const NAMES = ["abrir_link", "gravar_respostas"];
const target = resolveTarget(__ENV);

// Gerado por prepare-meridian-responder.ts (tokens, perguntas, id da action).
const data = JSON.parse(open("./.tokens.json"));

export const options = buildOptions({
  target,
  names: NAMES,
  peakVus: 50,
  minutes: 3,
  p95Ms: 800,
  errorRate: 0.01,
});

export const handleSummary = makeSummary("meridian-responder", NAMES, __ENV);

// A action é chamada como o navegador chama: POST na própria página, com o id
// da action no cabeçalho Next-Action e os argumentos em JSON.
function gravar(url, token) {
  const answers = data.questions.map((q) => ({
    questionId: q.id,
    rawValue: Math.floor(Math.random() * (q.max + 1)),
  }));
  return http.post(
    url,
    JSON.stringify([{ token, answers }]),
    requestParams(target, __ENV, {
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "text/x-component",
        "Next-Action": data.saveDraftActionId,
      },
      tags: { name: "gravar_respostas" },
    })
  );
}

export default function () {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const url = `${target.baseUrl}/meridian-responder/${token}`;

  const page = http.get(
    url,
    requestParams(target, __ENV, { tags: { name: "abrir_link" } })
  );
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
