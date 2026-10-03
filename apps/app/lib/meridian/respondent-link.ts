// Link do respondente e leitura do token no navegador (achado 28a do Lacre).
//
// O token vai no FRAGMENTO da URL (`/meridian-responder#t=<token>`). O navegador
// nunca envia o fragmento ao servidor, então nenhuma requisição, de nenhuma
// etapa, carrega o token no endereço, e portanto ele não aparece nos logs de
// runtime da Vercel. A página lê `location.hash` no cliente e o troca por sessão
// numa server action (POST, corpo e não URL).
//
// Sem dependência de servidor: o componente do cliente importa este arquivo.

export const RESPONDENT_PATH = "/meridian-responder";

/** Forma que um token aceita antes de qualquer consulta: seguro para cookie e
 *  com tamanho limitado. O emitido é hex de 64; a fixture de E2E não é. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;
const HASH_TOKEN = /^#t=([A-Za-z0-9_-]{16,128})$/;

export const isTokenShape = (value: string): boolean => TOKEN_SHAPE.test(value);

/** O link que a consultoria entrega ao respondente. */
export const respondentLink = (origin: string, token: string): string =>
  `${origin}${RESPONDENT_PATH}#t=${token}`;

/** O token do fragmento `#t=<token>`, ou nulo se o fragmento não é isso. Só o
 *  formato exato: nada de parâmetros extras nem segmentos de caminho. */
export function tokenFromHash(hash: string): string | null {
  const m = HASH_TOKEN.exec(hash);
  return m?.[1] ?? null;
}
