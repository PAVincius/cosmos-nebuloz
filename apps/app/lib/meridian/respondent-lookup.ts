import "server-only";

import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { MeridianRuleError } from "@/lib/meridian/guards";
import {
  hashToken,
  isTokenUsable,
  TOKEN_INVALID_MESSAGE,
  TOKEN_RATE_LIMITED_MESSAGE,
} from "@/lib/meridian/respondent-token";

// Consulta do respondente pelo token, com o teto de tentativas por IP.
//
// Mora aqui, e não no arquivo "use server" das actions, porque duas portas
// precisam dela: as server actions (que leem o token do cookie de sessão) e o
// Route Handler da primeira carga (que troca o token da URL pelo cookie). Um
// arquivo "use server" só exporta server actions — e esta função, exposta como
// action, seria um endpoint público de sondagem de token.

export const TOKEN_ERROR = new MeridianRuleError(
  "respondent.invalid-token",
  TOKEN_INVALID_MESSAGE
);

const RATE_LIMIT_ERROR = new MeridianRuleError(
  "respondent.rate-limited",
  TOKEN_RATE_LIMITED_MESSAGE
);

// Rate limit do lookup de token — condição 5 do parecer de compliance
// (docs/compliance/2026-09-24-parecer-meridian-respondente.md) e P2 do Vigia
// (docs/qualidade/dogfood/meridian/atrito.md:48): sem isso, nada impedia
// tentativa repetida de adivinhar um hash de token válido. Sem sessão, IP é o
// único identificador disponível — prefere `x-real-ip` (posto pelo proxy,
// não editável pelo cliente) e só cai para o primeiro `x-forwarded-for`
// quando aquele não vem.
//
// Duas etapas, não uma (revisão da Morgana sobre a primeira versão): checar
// o teto ANTES de consultar o banco, e só INCREMENTAR depois de um miss.
// Checar só depois do miss (a v1) deixava um IP já acima do teto continuar
// acertando token válido — sucesso nunca chamava o limitador, então o teto só
// mudava a mensagem de erro, não freava a força bruta de verdade. E
// incrementar em todo request (a v0, antes da v1) contava sucesso e falha
// igual — um escritório inteiro atrás do mesmo IP, respondendo de verdade,
// estourava o teto e via "link inválido" no próprio link certo.
async function lookupIdentifierIp(): Promise<string> {
  const headerStore = await headers();
  return (
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

async function tokenLookupLimiter() {
  const { createRateLimiter, fixedWindow } = await import("@repo/rate-limit");
  return createRateLimiter({
    limiter: fixedWindow(30, "1 m"),
    prefix: "meridian-token-lookup",
  });
}

/** Só leitura, ANTES da consulta por hash — recusa sem gastar a consulta
 *  quando o IP já está no teto. Fecha em produção se o contador estiver fora
 *  do ar, mesmo raciocínio do copiloto
 *  (app/actions/safe-copilot/rate-limit-gate.ts): se abrisse, derrubar o
 *  contador viraria a forma de remover o freio. */
async function rejectIfAlreadyRateLimited(ip: string): Promise<void> {
  let dentroDoLimite: boolean;
  try {
    const limiter = await tokenLookupLimiter();
    dentroDoLimite = (await limiter.peek(ip)).success;
  } catch (erro) {
    if (process.env.NODE_ENV === "production") {
      log.error(
        "[meridian] rate limit de lookup de token indisponível (peek)",
        { error: String(erro) }
      );
      dentroDoLimite = false;
    } else {
      dentroDoLimite = true;
    }
  }

  if (!dentroDoLimite) {
    throw RATE_LIMIT_ERROR;
  }
}

/** Chamado só depois que o lookup por hash JÁ falhou — um respondente
 *  legítimo nunca erra o próprio link, então nunca soma contra o teto; só
 *  tentativa de adivinhação gera falha atrás de falha. O gate real é o
 *  `rejectIfAlreadyRateLimited` acima; se o incremento aqui falhar, o
 *  TOKEN_ERROR do chamador ainda vale — só perde-se esta contagem. */
async function recordTokenLookupFailure(ip: string): Promise<void> {
  try {
    const limiter = await tokenLookupLimiter();
    await limiter.limit(ip);
  } catch (erro) {
    log.error("[meridian] rate limit de lookup de token indisponível (limit)", {
      error: String(erro),
    });
  }
}

/** Consulta única por `tokenHash`, usada por toda a superfície do respondente
 *  (`resolveRespondentToken` e `loadRespondent`) — as duas precisam do mesmo
 *  freio contra adivinhação, então compartilham a mesma implementação em vez
 *  de cada uma reimplementar a checagem. */
export async function findRespondentByTokenOrThrow(token: string) {
  const ip = await lookupIdentifierIp();
  await rejectIfAlreadyRateLimited(ip);

  const r = await database.meridianRespondent.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      assessment: {
        select: {
          id: true,
          code: true,
          orgName: true,
          templateId: true,
          status: true,
        },
      },
    },
  });
  if (r && isTokenUsable(r, new Date())) {
    return r;
  }
  await recordTokenLookupFailure(ip);
  throw TOKEN_ERROR;
}
