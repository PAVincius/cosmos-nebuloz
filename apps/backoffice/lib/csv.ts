import "server-only";
import { log } from "@repo/observability/log";
import { FUSO_DO_PAINEL } from "./data";
import { StaffAuthError } from "./guard";
import { RateLimitError } from "./rate-limit";

/**
 * CSV para quem abre no Excel em português.
 *
 * Três escolhas, cada uma por um tropeço concreto. BOM na frente: sem ele o
 * Excel lê UTF-8 como Windows-1252 e "Ação" vira "AÃ§Ã£o". Ponto e vírgula
 * como separador: no Excel pt-BR a vírgula é o decimal, e um CSV de vírgulas
 * abre tudo numa coluna só. CRLF entre linhas, como pede a RFC 4180.
 *
 * E uma de segurança: texto que começa com `=`, `+`, `@` (ou `-` sem ser
 * número) o Excel executa como fórmula. A trilha de auditoria carrega texto
 * que veio de fora — nome de cliente, alvo, autor —, então essas células
 * ganham um apóstrofo na frente e abrem como texto.
 */

export type Celula = string | number | null | undefined;

/** Escrito por código, não literal: o caractere é invisível no editor. */
const BOM = String.fromCharCode(0xfe_ff);
const PRECISA_DE_ASPAS = /[;"\r\n]/;
const PARECE_FORMULA = /^[=+@\t\r]/;
const NUMERO_NEGATIVO = /^-[\d.,]+$/;

function neutralizar(texto: string): string {
  if (PARECE_FORMULA.test(texto)) {
    return `'${texto}`;
  }
  if (texto.startsWith("-") && !NUMERO_NEGATIVO.test(texto)) {
    return `'${texto}`;
  }
  return texto;
}

function celula(valor: Celula): string {
  if (valor === null || valor === undefined) {
    return "";
  }
  if (typeof valor === "number") {
    return String(valor);
  }
  const texto = neutralizar(valor);
  return PRECISA_DE_ASPAS.test(texto)
    ? `"${texto.replaceAll('"', '""')}"`
    : texto;
}

/** O arquivo inteiro: BOM, cabeçalho e uma linha por registro, cada linha
 *  terminada em CRLF. */
export function paraCsv(cabecalho: string[], linhas: Celula[][]): string {
  const corpo = [cabecalho, ...linhas]
    .map((linha) => `${linha.map(celula).join(";")}\r\n`)
    .join("");
  return `${BOM}${corpo}`;
}

/** Centavos como o Excel pt-BR lê número: vírgula decimal, sem milhar
 *  ("1234,56") — o ponto de milhar faria a célula virar texto. */
export function centavosParaCsv(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

const dataDoArquivo = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DO_PAINEL,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** A resposta que o navegador baixa: `attachment` com o nome e a data de
 *  hoje no fuso do painel, e sem cache — é um retrato de agora. */
export function respostaCsv(nome: string, conteudo: string): Response {
  const hoje = dataDoArquivo.format(new Date());
  return new Response(conteudo, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${nome}-${hoje}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

const STATUS_DA_RECUSA: Record<string, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
};

/** A falha da exportação em status HTTP: 401/403 do guard, 429 do teto, 500
 *  para o resto — com a mensagem do guard (que é para a pessoa ler) e a
 *  genérica no lugar de erro de banco, que fica só no log. */
export function respostaDeFalha(erro: unknown): Response {
  if (erro instanceof StaffAuthError) {
    return new Response(erro.message, {
      status: STATUS_DA_RECUSA[erro.code] ?? 403,
    });
  }
  if (erro instanceof RateLimitError) {
    return new Response(erro.message, { status: 429 });
  }
  log.error("[backoffice] exportação CSV", { error: String(erro) });
  return new Response("Não foi possível gerar o arquivo.", { status: 500 });
}
