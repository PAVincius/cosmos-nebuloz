// Trava de alvo da carga. Toda script de produto chama `resolveTarget()` no
// contexto de init: se o alvo não é permitido, o k6 aborta antes de qualquer
// requisição.
//
// Regras:
//   - padrão: só localhost / 127.0.0.1 (o app local sobe na 3012);
//   - produção (`*.nebuloz.ai` e o alias `<projeto>.vercel.app` dos quatro
//     projetos) é recusada sempre, sem variável que a libere;
//   - alvo remoto (preview ou infra de teste) exige TRÊS coisas explícitas:
//       BASE_URL=https://<host>             o alvo
//       K6_ALLOW_REMOTE=https://<host>      a mesma origem, repetida de propósito
//       K6_APPROVAL=<id do "vai" do CEO>    quem autorizou e quando
//     e ainda cai nos tetos de `buildOptions` (VUs e minutos), ver options.js.
import { fail } from "k6";

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ORIGIN_HOST = /^https?:\/\/([^/:]+)/;
const TRAILING_SLASHES = /\/+$/;
const PRODUCTION_DOMAINS = ["nebuloz.ai"];
// O alias `<projeto>.vercel.app` é a produção do projeto na Vercel; só o nome
// distingue de um preview (`<projeto>-<hash>-<time>.vercel.app`). Recusa exata.
const PRODUCTION_HOSTS = [
  "cosmos-nebuloz-app.vercel.app",
  "cosmos-nebuloz-backoffice.vercel.app",
  "cosmos-nebuloz-api.vercel.app",
  "nebuloz-web.vercel.app",
];

function hostOf(origin) {
  const m = ORIGIN_HOST.exec(origin);
  return m ? m[1].toLowerCase() : "";
}

function isProduction(host) {
  return (
    PRODUCTION_HOSTS.includes(host) ||
    PRODUCTION_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
  );
}

/**
 * @param {Record<string,string>} env normalmente `__ENV`
 * @returns {{ baseUrl: string, remote: boolean, approval: string | null }}
 */
export function resolveTarget(env) {
  const baseUrl = (env.BASE_URL || "http://localhost:3012").replace(
    TRAILING_SLASHES,
    ""
  );

  if (LOCAL.test(baseUrl)) {
    return { baseUrl, remote: false, approval: null };
  }

  const host = hostOf(baseUrl);
  if (isProduction(host)) {
    fail(
      `BASE_URL aponta para produção (${host}). Carga em produção não é permitida por este script.`
    );
  }
  if (!baseUrl.startsWith("https://")) {
    fail(`Alvo remoto tem de ser https://: ${baseUrl}`);
  }
  if (env.K6_ALLOW_REMOTE !== baseUrl) {
    fail(
      `Alvo remoto ${baseUrl} sem K6_ALLOW_REMOTE=${baseUrl}. Repita a origem para confirmar.`
    );
  }
  if (!env.K6_APPROVAL) {
    fail(
      "Alvo remoto sem K6_APPROVAL. Informe o id do vai do CEO (ex.: K6_APPROVAL=vai-2026-10-02-ceo)."
    );
  }
  return { baseUrl, remote: true, approval: env.K6_APPROVAL };
}

/**
 * Parâmetros de requisição comuns. Preview da Vercel costuma estar atrás de
 * Deployment Protection: o segredo de bypass vem de K6_BYPASS_TOKEN (nunca
 * versionado) e só é enviado a alvo remoto.
 */
export function requestParams(target, env, params) {
  const headers = { ...params?.headers };
  if (target.remote && env.K6_BYPASS_TOKEN) {
    headers["x-vercel-protection-bypass"] = env.K6_BYPASS_TOKEN;
  }
  return { ...params, headers };
}
