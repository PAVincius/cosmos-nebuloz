/**
 * A causa de uma integração quebrada, dita sem vazar credencial.
 *
 * `SyncLog.errors` é `Json?` com o texto do provedor — e provedor devolve
 * token no erro: "Bad credentials for ghp_…", "Authorization: Bearer …", URL
 * com usuário e senha. A credencial é write-only (NFR-1.7): não pode chegar à
 * tela pela porta dos fundos da mensagem de erro. O corte é por padrão
 * conhecido, e sequência opaca longa sai por via das dúvidas — um id que
 * some da mensagem custa menos que um token que aparece.
 *
 * Mora em `lib/` porque módulo `"use server"` só exporta função async, e a
 * aba Integrações do cliente (`actions/tenant-observability.ts`) lê o mesmo
 * campo.
 */

/** Teto do que atravessa a rede. A tela ainda trunca para caber na linha. */
export const MAXIMO_DA_MENSAGEM = 500;

const OCULTO = "[oculto]";

/** Chaves cujo valor é segredo, em `chave=valor` ou `chave: valor`. */
const CHAVE_SENSIVEL =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|token|secret|password|passwd|senha|apikey)(\s*[:=]\s*)("?)[^\s"'&,;)]+\3/gi;

/** `Authorization: Bearer <credencial>` (ou Basic). O esquema fica. */
const ESQUEMA_DE_AUTORIZACAO = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g;

/** Tokens por padrão conhecido — saem inteiros. */
const PADROES: RegExp[] = [
  // JWT
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // GitHub, GitLab, Linear, Slack, OpenAI, AWS
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{16,}/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\blin_(?:api|oauth)_[A-Za-z0-9]{16,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  // Sequência opaca longa sem prefixo conhecido.
  /\b[A-Za-z0-9+/_-]{32,}={0,2}/g,
];

/** Usuário e senha embutidos em URL: `https://ana:s3nh4@host`. */
const CREDENCIAL_NA_URL = /:\/\/[^\s/:@]+:[^\s/@]+@/g;

export function semSegredo(texto: string): string {
  let limpo = texto
    .replace(CREDENCIAL_NA_URL, `://${OCULTO}@`)
    .replace(CHAVE_SENSIVEL, `$1$2${OCULTO}`)
    .replace(ESQUEMA_DE_AUTORIZACAO, `$1 ${OCULTO}`);
  for (const padrao of PADROES) {
    limpo = limpo.replace(padrao, OCULTO);
  }
  return limpo;
}

/**
 * A causa legível do erro. `SyncLog.errors` pode chegar como objeto com
 * `message`, como string ou como array — ler um formato só produzia o "erro
 * sem causa" que o FR-4.4.2 proíbe. Sem nada legível, nulo: nunca uma causa
 * plausível inventada.
 */
export function causaDoErro(errors: unknown): string | null {
  if (!errors) {
    return null;
  }
  if (typeof errors === "string") {
    return errors;
  }
  if (Array.isArray(errors)) {
    return errors.length === 0 ? null : causaDoErro(errors[0]);
  }
  if (typeof errors === "object" && "message" in errors) {
    return String((errors as { message: unknown }).message);
  }
  return null;
}

/** `causaDoErro` + `semSegredo` + teto de tamanho: o que pode ir à tela. */
export function mensagemDeErro(errors: unknown): string | null {
  const causa = causaDoErro(errors);
  if (causa === null) {
    return null;
  }
  const limpa = semSegredo(causa.trim());
  return limpa.length > MAXIMO_DA_MENSAGEM
    ? `${limpa.slice(0, MAXIMO_DA_MENSAGEM - 1).trimEnd()}…`
    : limpa;
}
